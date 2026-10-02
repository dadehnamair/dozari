import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { TOKEN_TTL_SECONDS, createTokenSigner } from '../auth/tokens.js';

const SECRET = 'a-test-secret-that-is-long-enough';
const DEVICE = '0f8fad5b-d9cb-469f-a165-70867728950e';

function memoryUsers() {
  const byId = new Map<string, UserRecord & { deviceId: string; touched: number }>();
  const repo: UserRepository = {
    async findByDeviceId(d) { return [...byId.values()].find((u) => u.deviceId === d) ?? null; },
    async findById(id) { return byId.get(id) ?? null; },
    async createGuest(deviceId, identity) {
      const existing = [...byId.values()].find((u) => u.deviceId === deviceId);
      if (existing) return existing;
      const user = { id: `00000000-0000-7000-8000-${String(byId.size + 1).padStart(12, '0')}`, deviceId, ...identity, isBanned: false, touched: 0 };
      byId.set(user.id, user);
      return user;
    },
    async touch(id) { const u = byId.get(id); if (u) u.touched += 1; },
  };
  return { repo, byId };
}

function setup(now = () => 1_700_000_000_000) {
  const users = memoryUsers();
  const tokens = createTokenSigner(SECRET, now);
  const auth = new AuthService(users.repo, tokens, mulberry32(3));
  return { ...users, tokens, auth, app: buildServer({ auth }) };
}

describe('tokens', () => {
  it('round-trips a user id', async () => {
    const t = createTokenSigner(SECRET);
    expect((await t.verify(await t.sign('user-1')))?.userId).toBe('user-1');
  });

  it('rejects tampered, foreign-secret, garbage and expired tokens', async () => {
    let clock = 1_700_000_000_000;
    const t = createTokenSigner(SECRET, () => clock);
    const token = await t.sign('user-1');
    expect(await t.verify(token.slice(0, -2) + 'xx')).toBeNull();
    expect(await createTokenSigner('another-secret-long-enough-x', () => clock).verify(token)).toBeNull();
    expect(await t.verify('not-a-jwt')).toBeNull();
    clock += (TOKEN_TTL_SECONDS + 5) * 1000;
    expect(await t.verify(token)).toBeNull();
  });

  it('refuses a weak secret', () => {
    expect(() => createTokenSigner('short')).toThrow();
  });
});

describe('log out everywhere', () => {
  it('refuses tokens issued before sessionsValidAfter, accepts later ones, and a ban kills the session too', async () => {
    let clock = 1_700_000_000_000;
    const users = memoryUsers();
    const tokens = createTokenSigner(SECRET, () => clock);
    const auth = new AuthService(users.repo, tokens, mulberry32(3));
    const login = await auth.guestLogin(DEVICE);
    if (!login.ok) throw new Error('login failed');
    const id = login.session.user.id;
    expect(await auth.authenticate(login.session.token)).not.toBeNull();
    clock += 5_000;
    users.byId.get(id)!.sessionsValidAfter = clock; // admin: log out everywhere
    expect(await auth.authenticate(login.session.token)).toBeNull();
    const again = await auth.guestLogin(DEVICE);
    if (!again.ok) throw new Error('login failed');
    expect(await auth.authenticate(again.session.token)).not.toBeNull(); // a fresh login works
  });
});

describe('delete account', () => {
  it('anonymizes the account, kills its sessions, and the same device then starts a fresh guest', async () => {
    const users = memoryUsers();
    const repo: UserRepository = {
      ...users.repo,
      async anonymize(id) {
        const u = users.byId.get(id)!;
        u.isBanned = true;
        u.nickname = 'حساب حذف‌شده';
        (u as { deviceId: string | null }).deviceId = null;
      },
    };
    const auth = new AuthService(repo, createTokenSigner(SECRET), mulberry32(3));
    const app = buildServer({ auth });
    const login = await auth.guestLogin(DEVICE);
    if (!login.ok) throw new Error('login failed');
    const headers = { authorization: `Bearer ${login.session.token}` };
    expect((await app.inject({ method: 'DELETE', url: '/me', headers })).json()).toEqual({ ok: true });
    expect((await app.inject({ method: 'GET', url: '/me', headers })).statusCode).toBe(401);
    const again = await auth.guestLogin(DEVICE);
    if (!again.ok) throw new Error('login failed');
    expect(again.session.user.id).not.toBe(login.session.user.id);
    expect((await app.inject({ method: 'POST', url: '/me/sign-out-everywhere', headers })).statusCode).toBe(401);
  });
});

describe('guest login', () => {
  it('creates an account with a preset nickname and avatar, then returns the same one for the same device', async () => {
    const { app, byId } = setup();
    const first = await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: DEVICE } });
    expect(first.statusCode).toBe(200);
    const a = first.json() as { token: string; user: { id: string; nickname: string; avatarKey: string } };
    expect(a.user.nickname.length).toBeGreaterThan(0);
    expect(a.user.avatarKey).toMatch(/^avatar-\d\d$/);
    const second = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: DEVICE } })).json() as typeof a;
    expect(second.user).toEqual(a.user);
    expect(byId.size).toBe(1);
    expect(byId.get(a.user.id)?.touched).toBe(2);
  });

  it('gives different devices different accounts', async () => {
    const { app, byId } = setup();
    await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: DEVICE } });
    await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: 'another-device-id-123456' } });
    expect(byId.size).toBe(2);
  });

  it('rejects a malformed request', async () => {
    const { app } = setup();
    for (const payload of [{}, { deviceId: 'short' }, { deviceId: 12345678901234567 }, { deviceId: '../../etc/passwd/../../x' }]) {
      expect((await app.inject({ method: 'POST', url: '/auth/guest', payload })).statusCode).toBe(400);
    }
  });

  it('refuses a banned device', async () => {
    const { app, byId } = setup();
    await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: DEVICE } });
    for (const u of byId.values()) u.isBanned = true;
    const res = await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: DEVICE } });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'banned' });
  });
});

describe('/me', () => {
  it('returns the caller for a valid bearer token', async () => {
    const { app } = setup();
    const login = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: DEVICE } })).json() as { token: string; user: { id: string } };
    const res = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${login.token}` } });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { id: string }).id).toBe(login.user.id);
  });

  it('is 401 without, with a bad, or with a banned user\'s token', async () => {
    const { app, byId } = setup();
    expect((await app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Bearer nope' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Basic abc' } })).statusCode).toBe(401);
    const login = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: DEVICE } })).json() as { token: string };
    for (const u of byId.values()) u.isBanned = true;
    expect((await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${login.token}` } })).statusCode).toBe(401);
  });
});
