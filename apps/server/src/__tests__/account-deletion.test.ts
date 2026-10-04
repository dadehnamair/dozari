import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { AccountDeletion, createMemoryDeleteCodeStore } from '../account/deletion.js';
import { createMemoryPhoneStore } from '../phone/store.js';

function memoryUsers(): UserRepository & { gone: Set<string> } {
  const byId = new Map<string, UserRecord & { deviceId: string }>();
  const gone = new Set<string>();
  return {
    gone,
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
    async anonymize(id) {
      gone.add(id);
    },
  };
}

function boot(opts: { phone?: boolean; sms?: boolean; bale?: boolean } = {}) {
  const users = memoryUsers();
  const auth = new AuthService(users, createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
  const phones = createMemoryPhoneStore();
  const sent: string[] = [];
  const clock = { t: 1_000_000 };
  let n = 0;
  const deletion = new AccountDeletion(
    createMemoryDeleteCodeStore(),
    phones,
    opts.sms === false ? null : { sendCode: async (_p, c) => void sent.push(`sms:${c}`) },
    opts.bale ? async (_id, text) => (sent.push(`bale:${text}`), true) : null,
    () => clock.t,
    () => String(11111 + n++),
  );
  const app = buildServer({ auth, deletion });
  const login = async () => {
    const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: '0f8fad5b-d9cb-469f-a165-708677289501' } })).json() as { token: string; user: { id: string } };
    if (opts.phone) await phones.markVerified(r.user.id, '+989121234567', 0);
    return { h: { authorization: `Bearer ${r.token}` }, id: r.user.id };
  };
  return { app, users, login, sent, clock };
}

describe('deleting the account needs a fresh one-time code', () => {
  it('refuses a one-tap delete: no code, no deletion', async () => {
    const { app, login, users } = boot({ phone: true });
    const a = await login();
    expect((await app.inject({ method: 'DELETE', url: '/me', headers: a.h })).statusCode).toBe(400);
    expect((await app.inject({ method: 'DELETE', url: '/me', headers: a.h, payload: { code: '12345' } })).json()).toEqual({ error: 'no_code' });
    expect(users.gone.size).toBe(0);
  });

  it('sends the code by SMS to the verified phone, rejects a wrong one, accepts the right one once', async () => {
    const { app, login, users, sent } = boot({ phone: true });
    const a = await login();
    expect((await app.inject({ method: 'POST', url: '/me/delete/code', headers: a.h })).json()).toEqual({ ok: true, channel: 'sms' });
    expect(sent).toEqual(['sms:11111']);
    expect((await app.inject({ method: 'DELETE', url: '/me', headers: a.h, payload: { code: '00000' } })).json()).toEqual({ error: 'wrong' });
    expect(users.gone.size).toBe(0);
    expect((await app.inject({ method: 'DELETE', url: '/me', headers: a.h, payload: { code: '11111' } })).json()).toEqual({ ok: true });
    expect(users.gone.has(a.id)).toBe(true);
    // the code is burnt
    expect((await app.inject({ method: 'DELETE', url: '/me', headers: a.h, payload: { code: '11111' } })).json()).toEqual({ error: 'no_code' });
  });

  it('falls back to the linked Bale chat; with no channel at all it cannot delete', async () => {
    const viaBale = boot({ bale: true });
    const a = await viaBale.login();
    expect((await viaBale.app.inject({ method: 'POST', url: '/me/delete/code', headers: a.h })).json()).toEqual({ ok: true, channel: 'bale' });
    expect(viaBale.sent[0]).toContain('11111');

    const none = boot();
    const b = await none.login();
    const res = await none.app.inject({ method: 'POST', url: '/me/delete/code', headers: b.h });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'no_channel' });
  });

  it('limits resends, expires after ten minutes and stops after five wrong tries', async () => {
    const { app, login, clock } = boot({ phone: true });
    const a = await login();
    await app.inject({ method: 'POST', url: '/me/delete/code', headers: a.h });
    expect((await app.inject({ method: 'POST', url: '/me/delete/code', headers: a.h })).statusCode).toBe(429);
    for (let i = 0; i < 5; i++) await app.inject({ method: 'DELETE', url: '/me', headers: a.h, payload: { code: '99999' } });
    expect((await app.inject({ method: 'DELETE', url: '/me', headers: a.h, payload: { code: '11111' } })).statusCode).toBe(429);
    clock.t += 11 * 60_000;
    await app.inject({ method: 'POST', url: '/me/delete/code', headers: a.h });
    clock.t += 11 * 60_000;
    expect((await app.inject({ method: 'DELETE', url: '/me', headers: a.h, payload: { code: '11112' } })).json()).toEqual({ error: 'expired' });
  });
});
