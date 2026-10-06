import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DEVICE_ID_PATTERN, mulberry32 } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { miniAppDeviceId, verifyMiniAppInitData } from '../auth/miniapp.js';
import { createTokenSigner } from '../auth/tokens.js';

const BOT = '123456:test-bot-token';
const NOW = 1_700_000_000_000;

/** Builds `initData` the way the Bale client does: sorted lines, HMAC keyed by HMAC("WebAppData", token). */
function sign(fields: Record<string, string>, token = BOT): string {
  const check = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}
const fields = (over: Record<string, string> = {}) => ({
  auth_date: String(NOW / 1000 - 60),
  query_id: 'q1',
  user: JSON.stringify({ id: 777, first_name: 'Ali', username: 'ali' }),
  ...over,
});

describe('verifyMiniAppInitData', () => {
  it('accepts a correctly signed string', () => {
    expect(verifyMiniAppInitData(sign(fields()), BOT, NOW)).toEqual({ id: '777', firstName: 'Ali', username: 'ali' });
  });
  it('rejects a wrong token, a changed field, a missing hash and stale data', () => {
    expect(verifyMiniAppInitData(sign(fields(), 'other:token'), BOT, NOW)).toBeNull();
    const tampered = sign(fields()).replace('777', '778');
    expect(verifyMiniAppInitData(tampered, BOT, NOW)).toBeNull();
    expect(verifyMiniAppInitData('auth_date=1', BOT, NOW)).toBeNull();
    expect(verifyMiniAppInitData(sign(fields({ auth_date: String(NOW / 1000 - 90_000) })), BOT, NOW)).toBeNull();
  });
  it('rejects a payload without a numeric user id', () => {
    expect(verifyMiniAppInitData(sign(fields({ user: '{"first_name":"x"}' })), BOT, NOW)).toBeNull();
  });
});

describe('miniAppDeviceId', () => {
  it('is stable, per user, and shaped like a device id', () => {
    expect(miniAppDeviceId(BOT, '777')).toBe(miniAppDeviceId(BOT, '777'));
    expect(miniAppDeviceId(BOT, '777')).not.toBe(miniAppDeviceId(BOT, '778'));
    expect(DEVICE_ID_PATTERN.test(miniAppDeviceId(BOT, '777'))).toBe(true);
  });
});

describe('POST /auth/miniapp', () => {
  function setup(botToken?: string, telegram?: string) {
    const byDevice = new Map<string, UserRecord>();
    const repo: UserRepository = {
      async findByDeviceId(d) { return byDevice.get(d) ?? null; },
      async findById(id) { return [...byDevice.values()].find((u) => u.id === id) ?? null; },
      async createGuest(deviceId, identity) {
        const user = { id: `00000000-0000-7000-8000-${String(byDevice.size + 1).padStart(12, '0')}`, ...identity, isBanned: false };
        byDevice.set(deviceId, user);
        return user;
      },
      async touch() {},
    };
    const auth = new AuthService(repo, createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
    return buildServer({ auth, miniApp: { bale: botToken, telegram } });
  }
  // The route verifies against the real clock, so sign with a fresh auth_date.
  const fresh = () => sign(fields({ auth_date: String(Math.floor(Date.now() / 1000)) }));

  it('logs the same messenger user into the same account every time', async () => {
    const app = setup(BOT);
    const a = await app.inject({ method: 'POST', url: '/auth/miniapp', payload: { initData: fresh() } });
    const b = await app.inject({ method: 'POST', url: '/auth/miniapp', payload: { initData: fresh() } });
    expect(a.statusCode).toBe(200);
    expect(a.json().user.id).toBe(b.json().user.id);
    expect(a.json().deviceId).toBe(miniAppDeviceId(BOT, '777'));
  });
  it('refuses forged data (401) and malformed bodies (400)', async () => {
    const app = setup(BOT);
    const forged = fresh().replace('777', '1');
    expect((await app.inject({ method: 'POST', url: '/auth/miniapp', payload: { initData: forged } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/auth/miniapp', payload: {} })).statusCode).toBe(400);
  });
  it('answers the preflight of a sandboxed iframe (Origin: null) and of the mini-app domain, but not of a stranger', async () => {
    const mk = (token?: string) => buildServer({ auth: new AuthService({ async findByDeviceId() { return null; }, async findById() { return null; }, async createGuest() { throw new Error('unused'); }, async touch() {} }, createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3)), miniApp: { bale: token }, corsOrigin: 'https://app.example.ir' });
    const preflight = async (app: ReturnType<typeof mk>, origin: string) =>
      (await app.inject({ method: 'OPTIONS', url: '/auth/miniapp', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } })).headers['access-control-allow-origin'];
    const on = mk(BOT);
    expect(await preflight(on, 'null')).toBe('null');
    expect(await preflight(on, 'https://app.example.ir')).toBe('https://app.example.ir');
    expect(await preflight(on, 'https://evil.example')).toBeUndefined();
    expect(await preflight(mk(), 'null')).toBeUndefined(); // no Bale login, no sandbox origin
  });
  it('logs a Telegram player in with the Telegram token, in an id space of its own', async () => {
    const TG = '999:telegram-bot-token';
    const app = setup(BOT, TG);
    const data = sign(fields({ auth_date: String(Math.floor(Date.now() / 1000)) }), TG);
    const tg = await app.inject({ method: 'POST', url: '/auth/miniapp', payload: { platform: 'telegram', initData: data } });
    expect(tg.statusCode).toBe(200);
    expect(tg.json().deviceId).toBe(miniAppDeviceId(TG, '777', 'telegram'));
    expect(tg.json().deviceId).not.toBe(miniAppDeviceId(BOT, '777', 'bale')); // same user number, different messenger: different account
    // Data signed for one messenger is not accepted as the other's.
    expect((await app.inject({ method: 'POST', url: '/auth/miniapp', payload: { platform: 'bale', initData: data } })).statusCode).toBe(401);
    // A platform without a token has no login.
    expect((await setup(BOT).inject({ method: 'POST', url: '/auth/miniapp', payload: { platform: 'telegram', initData: data } })).statusCode).toBe(404);
  });
  it('keeps the account ids of the first (Bale-only) release', () => {
    // The formula of the first release, written out: changing it would orphan every account made so far.
    expect(miniAppDeviceId(BOT, '777')).toBe(createHmac('sha256', BOT).update('dozari-bale-miniapp:777').digest('hex').slice(0, 32));
  });
  it('is not there without a bot token', async () => {
    const app = setup();
    expect((await app.inject({ method: 'POST', url: '/auth/miniapp', payload: { initData: fresh() } })).statusCode).toBe(404);
  });
});
