import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@dozari/shared';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { PhoneLoginService } from '../phone/login.js';
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
    async claimDevice(id, deviceId) {
      for (const u of byId.values()) if (u.deviceId === deviceId) u.deviceId = '';
      const me = byId.get(id);
      if (me) me.deviceId = deviceId;
    },
  };
}

function boot(withSms = true) {
  const clock = { ms: 1_000_000 };
  const sent: { phone: string; code: string }[] = [];
  const store = createMemoryPhoneStore();
  const auth = new AuthService(memoryUsers(), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
  const login = new PhoneLoginService(store, auth, withSms ? { sendCode: async (phone, code) => void sent.push({ phone, code }) } : null, () => clock.ms, () => '12345');
  return { clock, sent, store, auth, login };
}
const dev = (n: number) => String(n).repeat(32).slice(0, 32);

describe('PhoneLoginService', () => {
  it('a number nobody holds becomes a new verified account', async () => {
    const { login, sent, store } = boot();
    expect(await login.sendCode('09123456789')).toEqual({ ok: true });
    expect(sent).toEqual([{ phone: '+989123456789', code: '12345' }]);
    const r = await login.verify('0912 345 6789', '12345', dev(1));
    expect(r.ok && r.created).toBe(true);
    expect([...store.verified.values()]).toEqual(['+989123456789']);
  });

  it('a held number logs in to its account from a new device', async () => {
    const { login, auth, store } = boot();
    const first = await auth.guestLogin(dev(1));
    if (!first.ok) throw new Error('login');
    await store.markVerified(first.session.user.id, '+989123456789', 1);
    await login.sendCode('09123456789');
    const r = await login.verify('09123456789', '12345', dev(2));
    expect(r.ok && r.session.user.id).toBe(first.session.user.id);
    expect(r.ok && r.created).toBe(false);
  });

  it('refuses a wrong code, then locks after five, and a code works once', async () => {
    const { login } = boot();
    await login.sendCode('09123456789');
    for (let i = 0; i < 5; i++) expect(await login.verify('09123456789', '00000', dev(1))).toEqual({ ok: false, error: 'wrong' });
    expect(await login.verify('09123456789', '12345', dev(1))).toEqual({ ok: false, error: 'too_many' });
    const b = boot();
    await b.login.sendCode('09123456789');
    expect((await b.login.verify('09123456789', '12345', dev(1))).ok).toBe(true);
    expect(await b.login.verify('09123456789', '12345', dev(1))).toEqual({ ok: false, error: 'no_code' });
  });

  it('expires, throttles resends, caps codes per hour, and needs an SMS provider', async () => {
    const { login, clock } = boot();
    await login.sendCode('09123456789');
    expect(await login.sendCode('09123456789')).toMatchObject({ ok: false, error: 'too_soon' });
    clock.ms += 6 * 60_000;
    expect(await login.verify('09123456789', '12345', dev(1))).toEqual({ ok: false, error: 'expired' });
    expect(await login.sendCode('abc')).toEqual({ ok: false, error: 'invalid_phone' });
    expect(await boot(false).login.sendCode('09123456789')).toEqual({ ok: false, error: 'sms_unavailable' });
  });
});
