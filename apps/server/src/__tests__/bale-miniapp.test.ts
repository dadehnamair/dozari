import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DEVICE_ID_PATTERN, mulberry32 } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { baleDeviceId, verifyBaleInitData } from '../auth/bale-miniapp.js';
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

describe('verifyBaleInitData', () => {
  it('accepts a correctly signed string', () => {
    expect(verifyBaleInitData(sign(fields()), BOT, NOW)).toEqual({ id: '777', firstName: 'Ali', username: 'ali' });
  });
  it('rejects a wrong token, a changed field, a missing hash and stale data', () => {
    expect(verifyBaleInitData(sign(fields(), 'other:token'), BOT, NOW)).toBeNull();
    const tampered = sign(fields()).replace('777', '778');
    expect(verifyBaleInitData(tampered, BOT, NOW)).toBeNull();
    expect(verifyBaleInitData('auth_date=1', BOT, NOW)).toBeNull();
    expect(verifyBaleInitData(sign(fields({ auth_date: String(NOW / 1000 - 90_000) })), BOT, NOW)).toBeNull();
  });
  it('rejects a payload without a numeric user id', () => {
    expect(verifyBaleInitData(sign(fields({ user: '{"first_name":"x"}' })), BOT, NOW)).toBeNull();
  });
});

describe('baleDeviceId', () => {
  it('is stable, per user, and shaped like a device id', () => {
    expect(baleDeviceId(BOT, '777')).toBe(baleDeviceId(BOT, '777'));
    expect(baleDeviceId(BOT, '777')).not.toBe(baleDeviceId(BOT, '778'));
    expect(DEVICE_ID_PATTERN.test(baleDeviceId(BOT, '777'))).toBe(true);
  });
});

describe('POST /auth/bale-miniapp', () => {
  function setup(botToken?: string) {
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
    return buildServer({ auth, baleBotToken: botToken });
  }
  // The route verifies against the real clock, so sign with a fresh auth_date.
  const fresh = () => sign(fields({ auth_date: String(Math.floor(Date.now() / 1000)) }));

  it('logs the same Bale user into the same account every time', async () => {
    const app = setup(BOT);
    const a = await app.inject({ method: 'POST', url: '/auth/bale-miniapp', payload: { initData: fresh() } });
    const b = await app.inject({ method: 'POST', url: '/auth/bale-miniapp', payload: { initData: fresh() } });
    expect(a.statusCode).toBe(200);
    expect(a.json().user.id).toBe(b.json().user.id);
    expect(a.json().deviceId).toBe(baleDeviceId(BOT, '777'));
  });
  it('refuses forged data (401) and malformed bodies (400)', async () => {
    const app = setup(BOT);
    const forged = fresh().replace('777', '1');
    expect((await app.inject({ method: 'POST', url: '/auth/bale-miniapp', payload: { initData: forged } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/auth/bale-miniapp', payload: {} })).statusCode).toBe(400);
  });
  it('answers the preflight of a sandboxed iframe (Origin: null) and of the mini-app domain, but not of a stranger', async () => {
    const mk = (token?: string) => buildServer({ auth: new AuthService({ async findByDeviceId() { return null; }, async findById() { return null; }, async createGuest() { throw new Error('unused'); }, async touch() {} }, createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3)), baleBotToken: token, corsOrigin: 'https://app.example.ir' });
    const preflight = async (app: ReturnType<typeof mk>, origin: string) =>
      (await app.inject({ method: 'OPTIONS', url: '/auth/bale-miniapp', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } })).headers['access-control-allow-origin'];
    const on = mk(BOT);
    expect(await preflight(on, 'null')).toBe('null');
    expect(await preflight(on, 'https://app.example.ir')).toBe('https://app.example.ir');
    expect(await preflight(on, 'https://evil.example')).toBeUndefined();
    expect(await preflight(mk(), 'null')).toBeUndefined(); // no Bale login, no sandbox origin
  });
  it('is not there without a bot token', async () => {
    const app = setup();
    expect((await app.inject({ method: 'POST', url: '/auth/bale-miniapp', payload: { initData: fresh() } })).statusCode).toBe(404);
  });
});
