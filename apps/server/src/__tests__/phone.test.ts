import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import type { BaleClient } from '../notify/client.js';
import { NotifyService } from '../notify/service.js';
import { createMemoryNotifyStore } from '../notify/store.js';
import { PhoneService } from '../phone/service.js';
import type { SmsClient } from '../phone/sms.js';
import { createIrnotiClient, createKavenegarClient } from '../phone/sms.js';
import { createMemoryPhoneStore } from '../phone/store.js';

function memoryUsers(): UserRepository {
  const byId = new Map<string, UserRecord & { deviceId: string }>();
  return {
    async findByDeviceId(d) {
      return [...byId.values()].find((u) => u.deviceId === d) ?? null;
    },
    async findById(id) {
      return byId.get(id) ?? null;
    },
    async createGuest(deviceId, identity) {
      const user = { id: `00000000-0000-7000-8000-${String(byId.size + 1).padStart(12, '0')}`, deviceId, ...identity, isBanned: false };
      byId.set(user.id, user);
      return user;
    },
    async touch() {},
  };
}

function boot(sms: SmsClient | null = null) {
  const clock = { ms: 1_000_000 };
  const store = createMemoryPhoneStore();
  const phone = new PhoneService(store, async () => ({ smsTtlMs: 5 * 60_000, smsResendMs: 60_000 }), sms, () => clock.ms, () => '12345');
  const notifyStore = createMemoryNotifyStore();
  const sent: { chatId: string; text: string; opts?: { contactButton?: string; removeKeyboard?: boolean } }[] = [];
  const client: BaleClient = { async sendMessage(chatId, text, opts) { sent.push({ chatId, text, opts }); }, async getUpdates() { return []; } };
  const notify = new NotifyService(notifyStore, client, () => clock.ms, () => 'ABC234');
  notify.phone = phone;
  const auth = new AuthService(memoryUsers(), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
  const app = buildServer({ auth, phone, bale: { service: notify, botUsername: 'dozari_bot' } });
  const login = async (n: number) => {
    const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}` } })).json() as { token: string; user: { id: string } };
    return { h: { authorization: `Bearer ${r.token}` }, id: r.user.id };
  };
  const contact = (chat: number, fromId: number, ownerId: number | undefined, phoneNumber: string) => ({ update_id: 1, message: { message_id: 1, chat: { id: chat }, from: { id: fromId }, contact: { phone_number: phoneNumber, user_id: ownerId } } });
  return { app, login, store, notify, notifyStore, sent, clock, contact, phone };
}

describe('phone number', () => {
  it('normalises, masks and keeps it pending until verified', async () => {
    const { app, login } = boot();
    const a = await login(1);
    expect((await app.inject({ method: 'PUT', url: '/me/phone', headers: a.h, payload: { phone: '12345' } })).json()).toEqual({ error: 'invalid_phone' });
    const res = await app.inject({ method: 'PUT', url: '/me/phone', headers: a.h, payload: { phone: '۰۹۱۲-۳۴۵-۶۷۸۹' } });
    expect(res.json()).toEqual({ phone: null, pending: '0912 ••• 6789', verified: false, smsAvailable: false });
    expect((await app.inject({ method: 'GET', url: '/me/phone' })).statusCode).toBe(401);
  });

  it('Bale linking needs a number first', async () => {
    const { app, login } = boot();
    const a = await login(1);
    expect((await app.inject({ method: 'POST', url: '/bale/link-code', headers: a.h })).json()).toEqual({ error: 'phone_required' });
    await app.inject({ method: 'PUT', url: '/me/phone', headers: a.h, payload: { phone: '09123456789' } });
    expect((await app.inject({ method: 'POST', url: '/bale/link-code', headers: a.h })).statusCode).toBe(200);
  });
});

describe('verification by sharing the Bale contact', () => {
  async function linked() {
    const t = boot();
    const a = await t.login(1);
    await t.app.inject({ method: 'PUT', url: '/me/phone', headers: a.h, payload: { phone: '09123456789' } });
    await t.app.inject({ method: 'POST', url: '/bale/link-code', headers: a.h });
    await t.notify.handleUpdate({ update_id: 1, message: { message_id: 1, chat: { id: 555 }, from: { id: 777 }, text: '/start ABC234' } });
    return { ...t, a };
  }

  it('after linking the bot asks for the contact with a one-tap button; the own matching contact verifies', async () => {
    const { app, a, sent, notify, contact } = await linked();
    expect(sent.at(-1)).toMatchObject({ chatId: '555', opts: { contactButton: expect.any(String) } });
    await notify.handleUpdate(contact(555, 777, 777, '989123456789'));
    expect(sent.at(-1)!.text).toContain('تأیید شد');
    expect(sent.at(-1)!.opts).toEqual({ removeKeyboard: true });
    expect((await app.inject({ method: 'GET', url: '/me/phone', headers: a.h })).json()).toMatchObject({ phone: '0912 ••• 6789', pending: null, verified: true });
  });

  it('refuses somebody else\'s contact, a different number, and a missing owner id', async () => {
    const { app, a, sent, notify, contact } = await linked();
    await notify.handleUpdate(contact(555, 777, 888, '989123456789')); // forwarded contact of another person
    expect(sent.at(-1)!.text).toContain('یکی نیست');
    await notify.handleUpdate(contact(555, 777, 777, '09351112233')); // own contact, other number
    expect(sent.at(-1)!.text).toContain('یکی نیست');
    await notify.handleUpdate(contact(555, 777, undefined, '09123456789'));
    expect(sent.at(-1)!.text).toContain('یکی نیست');
    expect((await app.inject({ method: 'GET', url: '/me/phone', headers: a.h })).json()).toMatchObject({ verified: false });
  });

  it('a verified number cannot be claimed or verified by a second account; unlinked chats are ignored', async () => {
    const { app, a, login, notify, contact, sent } = await linked();
    await notify.handleUpdate(contact(555, 777, 777, '09123456789'));
    const b = await login(2);
    expect((await app.inject({ method: 'PUT', url: '/me/phone', headers: b.h, payload: { phone: '09123456789' } })).json()).toEqual({ error: 'taken' });
    await notify.handleUpdate(contact(999, 1, 1, '09123456789')); // chat that never linked
    expect(sent.at(-1)!.text).toContain('کد');
    expect(a.id).not.toBe(b.id);
  });
});

describe('verification by SMS', () => {
  const fakeSms = () => {
    const sent: { phone: string; code: string }[] = [];
    let fail = false;
    return { sent, setFail: (v: boolean) => (fail = v), client: { async sendCode(phone: string, code: string) { if (fail) throw new Error('x'); sent.push({ phone, code }); } } as SmsClient };
  };

  it('sends a code, accepts the right one once, limits resends and attempts', async () => {
    const sms = fakeSms();
    const { app, login, clock } = boot(sms.client);
    const a = await login(1);
    const post = (url: string, payload?: Record<string, unknown>) => app.inject({ method: 'POST', url, headers: a.h, payload });
    expect((await post('/me/phone/sms')).json()).toEqual({ error: 'no_pending' });
    await app.inject({ method: 'PUT', url: '/me/phone', headers: a.h, payload: { phone: '09123456789' } });
    expect((await post('/me/phone/sms')).statusCode).toBe(200);
    expect(sms.sent).toEqual([{ phone: '+989123456789', code: '12345' }]);
    const soon = await post('/me/phone/sms');
    expect(soon.statusCode).toBe(429);
    expect(soon.json()).toMatchObject({ error: 'too_soon', retryAfterSec: 60 });
    expect((await post('/me/phone/verify', { code: '00000' })).json()).toEqual({ error: 'wrong' });
    expect((await post('/me/phone/verify', { code: '12345' })).json()).toMatchObject({ verified: true, phone: '0912 ••• 6789' });
    expect((await post('/me/phone/verify', { code: '12345' })).json()).toEqual({ error: 'no_code' });
    clock.ms += 1;
  });

  it('expires, and locks after five wrong tries', async () => {
    const sms = fakeSms();
    const { app, login, clock } = boot(sms.client);
    const a = await login(1);
    const post = (url: string, payload?: Record<string, unknown>) => app.inject({ method: 'POST', url, headers: a.h, payload });
    await app.inject({ method: 'PUT', url: '/me/phone', headers: a.h, payload: { phone: '09123456789' } });
    await post('/me/phone/sms');
    clock.ms += 5 * 60_000 + 1;
    expect((await post('/me/phone/verify', { code: '12345' })).json()).toEqual({ error: 'expired' });
    await post('/me/phone/sms');
    for (let i = 0; i < 5; i++) await post('/me/phone/verify', { code: '99999' });
    const locked = await post('/me/phone/verify', { code: '12345' });
    expect(locked.statusCode).toBe(429);
    expect(locked.json()).toEqual({ error: 'too_many' });
  });

  it('is unavailable without a provider, and reports provider failures', async () => {
    const none = boot(null);
    const a = await none.login(1);
    await none.app.inject({ method: 'PUT', url: '/me/phone', headers: a.h, payload: { phone: '09123456789' } });
    expect((await none.app.inject({ method: 'POST', url: '/me/phone/sms', headers: a.h })).statusCode).toBe(503);
    const sms = fakeSms();
    sms.setFail(true);
    const t = boot(sms.client);
    const b = await t.login(1);
    await t.app.inject({ method: 'PUT', url: '/me/phone', headers: b.h, payload: { phone: '09123456789' } });
    expect((await t.app.inject({ method: 'POST', url: '/me/phone/sms', headers: b.h })).statusCode).toBe(502);
  });

  it('changing the number cancels a code that was sent to the old one', async () => {
    const sms = fakeSms();
    const { app, login } = boot(sms.client);
    const a = await login(1);
    await app.inject({ method: 'PUT', url: '/me/phone', headers: a.h, payload: { phone: '09123456789' } });
    await app.inject({ method: 'POST', url: '/me/phone/sms', headers: a.h });
    await app.inject({ method: 'PUT', url: '/me/phone', headers: a.h, payload: { phone: '09351112233' } });
    expect((await app.inject({ method: 'POST', url: '/me/phone/verify', headers: a.h, payload: { code: '12345' } })).json()).toEqual({ error: 'no_code' });
  });
});

describe('Kavenegar adapter', () => {
  it('calls verify/lookup with the receptor in national form and fails on a provider error', async () => {
    const urls: string[] = [];
    const ok = createKavenegarClient('KEY', 'dozari', { fetchImpl: (async (u: string) => (urls.push(u), { ok: true, status: 200, json: async () => ({ return: { status: 200 } }) })) as unknown as typeof fetch });
    await ok.sendCode('+989123456789', '12345');
    expect(urls[0]).toBe('https://api.kavenegar.com/v1/KEY/verify/lookup.json?receptor=09123456789&token=12345&template=dozari');
    const bad = createKavenegarClient('KEY', 'dozari', { fetchImpl: (async () => ({ ok: true, status: 200, json: async () => ({ return: { status: 411 } }) })) as unknown as typeof fetch });
    await expect(bad.sendCode('+989123456789', '1')).rejects.toThrow();
  });
});

describe('irnoti adapter', () => {
  it('posts {to, message} with a Bearer key, using the national number and the code in the text', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => (calls.push({ url, init }), { ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    await createIrnotiClient('irnt_KEY', { fetchImpl: f }).sendCode('+989123456789', '12345');
    expect(calls[0]!.url).toBe('https://irnoti.com/api/v1/sms/send');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer irnt_KEY');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ to: '09123456789', message: 'کد ورود دوزاری: 12345' });
  });

  it('uses a custom message containing {code} and fails on HTTP errors or an error body', async () => {
    const bodies: string[] = [];
    const ok = createIrnotiClient('k', { message: 'code={code}!', fetchImpl: (async (_u: string, init: RequestInit) => (bodies.push(String(init.body)), { ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch });
    await ok.sendCode('+989121111111', '777');
    expect(JSON.parse(bodies[0]!).message).toBe('code=777!');
    const http = createIrnotiClient('k', { fetchImpl: (async () => ({ ok: false, status: 401, json: async () => ({}) })) as unknown as typeof fetch });
    await expect(http.sendCode('+989121111111', '1')).rejects.toThrow();
    const body = createIrnotiClient('k', { fetchImpl: (async () => ({ ok: true, status: 200, json: async () => ({ success: false }) })) as unknown as typeof fetch });
    await expect(body.sendCode('+989121111111', '1')).rejects.toThrow();
  });
});
