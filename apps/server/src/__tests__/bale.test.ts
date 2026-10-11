import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { createBaleClient } from '../notify/client.js';
import type { BaleClient } from '../notify/client.js';
import { NotifyService } from '../notify/service.js';
import { createMemoryNotifyStore } from '../notify/store.js';
import { createMemoryAuditLog } from '../admin/audit.js';
import { mulberry32 } from '@dozari/shared';

function fakeBale() {
  const sent: { chatId: string; text: string }[] = [];
  let fail = false;
  const client: BaleClient = {
    async sendMessage(chatId, text) {
      if (fail) throw new Error('boom');
      sent.push({ chatId, text });
    },
    async getUpdates() {
      return [];
    },
  };
  return { client, sent, setFail: (v: boolean) => (fail = v) };
}
const msg = (chat: number, text: string, id = 1) => ({ update_id: id, message: { message_id: id, chat: { id: chat }, text } });

describe('NotifyService', () => {
  function setup() {
    let t = 1_000_000;
    const store = createMemoryNotifyStore();
    const bale = fakeBale();
    const svc = new NotifyService(store, bale.client, () => t, () => 'ABC234');
    return { store, bale, svc, tick: (ms: number) => (t += ms) };
  }

  it('links a chat with the one-time code and replies in Persian', async () => {
    const { svc, bale, store } = setup();
    const { code } = await svc.linkCode('u1');
    expect(code).toBe('ABC234');
    await svc.handleUpdate(msg(555, 'hello'));
    expect(bale.sent.at(-1)!.text).toContain('کد');
    await svc.handleUpdate(msg(555, '/start ABC234'));
    expect(await store.chatOf('u1')).toBe('555');
    expect(bale.sent.at(-1)!.text).toContain('وصل شدی');
    await svc.handleUpdate(msg(555, 'abc234')); // codes are one-time
    expect(bale.sent.at(-1)!.text).toContain('درست نیست');
  });

  it('links with a code typed with Persian digits, zero-width marks or a deep-link start', async () => {
    const { bale } = setup();
    const svc2 = new NotifyService(createMemoryNotifyStore(), bale.client, () => 1_000_000, () => 'AB2345');
    const { code } = await svc2.linkCode('u9');
    await svc2.handleUpdate(msg(7, `/start ${code.replace('2345', '۲۳۴۵')}\u200c`));
    expect(bale.sent.at(-1)?.text).toContain('وصل شدی');
  });

  it('rejects an expired code', async () => {
    const { svc, bale, tick, store } = setup();
    await svc.linkCode('u1');
    tick(11 * 60_000);
    await svc.handleUpdate(msg(555, 'ABC234'));
    expect(await store.chatOf('u1')).toBeNull();
    expect(bale.sent.at(-1)!.text).toContain('منقضی');
  });

  it('stops on /stop and reports /status', async () => {
    const { svc, bale } = setup();
    await svc.linkCode('u1');
    await svc.handleUpdate(msg(7, 'ABC234'));
    await svc.handleUpdate(msg(7, '/status'));
    expect(bale.sent.at(-1)!.text).toContain('وصل هستی');
    await svc.handleUpdate(msg(7, '/stop'));
    expect(await svc.linked('u1')).toBe(false);
    await svc.handleUpdate(msg(7, '/stop'));
    expect(bale.sent.at(-1)!.text).toContain('هنوز');
  });

  it('only queues for linked players and sends through flush, retrying failures', async () => {
    const { svc, bale, store } = setup();
    expect(await svc.notify('u1', 'match_result', 'x')).toBe(false);
    await svc.linkCode('u1');
    await svc.handleUpdate(msg(9, 'ABC234'));
    expect(await svc.notify('u1', 'match_result', 'بردی')).toBe(true);
    bale.setFail(true);
    expect(await svc.flush()).toBe(0);
    expect((await store.stats()).pending).toBe(1);
    bale.setFail(false);
    expect(await svc.flush()).toBe(1);
    expect(bale.sent.at(-1)).toEqual({ chatId: '9', text: 'بردی' });
    expect(await svc.flush()).toBe(0);
  });

  it('parks a message as failed after five attempts', async () => {
    const { svc, bale, store } = setup();
    await svc.notifyChat('1234', 'admin', 'x');
    bale.setFail(true);
    for (let i = 0; i < 6; i++) await svc.flush();
    expect(await store.stats()).toMatchObject({ pending: 0, failed: 1 });
  });

  it('announces a ready daily reward once per claim', async () => {
    const { svc, store, tick, bale } = setup();
    await svc.linkCode('u1');
    await svc.handleUpdate(msg(3, 'ABC234'));
    const cooldown = 20 * 3_600_000;
    store.setClaim('u1', 1_000_000);
    expect(await svc.announceDaily(cooldown)).toBe(0); // still cooling down
    tick(cooldown + 1);
    expect(await svc.announceDaily(cooldown)).toBe(1);
    expect(await svc.announceDaily(cooldown)).toBe(0);
    await svc.flush();
    expect(bale.sent.at(-1)!.text).toContain('جایزه');
    store.setClaim('u1', 1_000_000 + cooldown + 5); // claimed again -> announce again next time
    tick(cooldown + 10);
    expect(await svc.announceDaily(cooldown)).toBe(1);
  });

  it('broadcasts to every linked player', async () => {
    const { svc, store } = setup();
    await svc.linkCode('u1');
    await svc.handleUpdate(msg(1, 'ABC234'));
    expect(await svc.broadcast('سلام همه')).toBe(1);
    expect((await store.stats()).pending).toBe(1);
  });
});

describe('Bale client', () => {
  it('posts to the Telegram-style endpoint and surfaces API errors', async () => {
    const calls: { url: string; body: unknown }[] = [];
    const ok = createBaleClient('TOKEN', { fetchImpl: (async (url: string, init: { body: string }) => (calls.push({ url, body: JSON.parse(init.body) }), new Response(JSON.stringify({ ok: true, result: [{ update_id: 4 }] }))) as unknown) as typeof fetch });
    await ok.sendMessage('12', 'hi');
    expect(await ok.getUpdates(3, 0)).toEqual([{ update_id: 4 }]);
    expect(calls[0]).toEqual({ url: 'https://tapi.bale.ai/botTOKEN/sendMessage', body: { chat_id: '12', text: 'hi' } });
    expect(calls[1]!.body).toEqual({ offset: 3, timeout: 0 });
    const bad = createBaleClient('T', { fetchImpl: (async () => new Response(JSON.stringify({ ok: false, description: 'Forbidden' }), { status: 403 })) as unknown as typeof fetch });
    await expect(bad.sendMessage('1', 'x')).rejects.toThrow('403 Forbidden');
  });
});

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

describe('bale routes', () => {
  const TOKEN = 'secret-admin-token';
  function boot(configured = true) {
    const auth = new AuthService(memoryUsers(), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
    const store = createMemoryNotifyStore();
    const service = new NotifyService(store, configured ? fakeBale().client : null, Date.now, () => 'QWE789');
    const audit = createMemoryAuditLog();
    const app = buildServer({
      auth,
      bale: { service, botUsername: 'dozari_bot' },
      admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: TOKEN },
      adminModules: { audit, bale: { service, store, botUsername: 'dozari_bot' } },
    });
    const login = async () => ((await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: '0f8fad5b-d9cb-469f-a165-708677289501' } })).json() as { token: string }).token;
    return { app, login, service, store };
  }

  it('gives a logged-in player a link code and tracks the link', async () => {
    const { app, login, service } = boot();
    expect((await app.inject({ method: 'POST', url: '/bale/link-code' })).statusCode).toBe(401);
    const h = { authorization: `Bearer ${await login()}` };
    const res = await app.inject({ method: 'POST', url: '/bale/link-code', headers: h });
    expect(res.json()).toMatchObject({ code: 'QWE789', botUsername: 'dozari_bot' });
    expect((await app.inject({ method: 'GET', url: '/bale/link', headers: h })).json()).toEqual({ configured: true, linked: false, botUsername: 'dozari_bot' });
    await service.handleUpdate(msg(42, 'QWE789'));
    expect((await app.inject({ method: 'GET', url: '/bale/link', headers: h })).json().linked).toBe(true);
    expect((await app.inject({ method: 'DELETE', url: '/bale/link', headers: h })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/bale/link', headers: h })).json().linked).toBe(false);
  });

  it('503 for a link code when the bot is not configured', async () => {
    const { app, login } = boot(false);
    const res = await app.inject({ method: 'POST', url: '/bale/link-code', headers: { authorization: `Bearer ${await login()}` } });
    expect(res.statusCode).toBe(503);
  });

  it('admin: status, broadcast, test message, audit', async () => {
    const { app, login, service } = boot();
    const h = { authorization: `Bearer ${await login()}` };
    await app.inject({ method: 'POST', url: '/bale/link-code', headers: h });
    await service.handleUpdate(msg(42, 'QWE789'));
    const admin = { 'x-admin-token': TOKEN };
    expect((await app.inject({ method: 'GET', url: '/admin/bale' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/admin/bale', headers: admin })).json()).toMatchObject({ configured: true, linked: 1 });
    expect((await app.inject({ method: 'POST', url: '/admin/bale/broadcast', headers: admin, payload: { text: 'سلام' } })).json()).toEqual({ queued: 1 });
    expect((await app.inject({ method: 'POST', url: '/admin/bale/broadcast', headers: admin, payload: { text: '' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/admin/bale/test', headers: admin, payload: { chatId: 'abc' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/admin/bale/test', headers: admin, payload: { chatId: '12345' } })).json()).toEqual({ queued: 1 });
    expect((await app.inject({ method: 'GET', url: '/admin/bale', headers: admin })).json().outbox.pending).toBe(2);
  });
});
