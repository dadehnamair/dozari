import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DEVICE_ID_PATTERN, mulberry32 } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRepository } from '../auth/service.js';
import { miniAppDeviceId } from '../auth/miniapp.js';
import { createTokenSigner } from '../auth/tokens.js';

const BOT = '123456:test-bot-token';

describe('miniAppDeviceId', () => {
  it('is stable, per user, and shaped like a device id', () => {
    expect(miniAppDeviceId(BOT, '777')).toBe(miniAppDeviceId(BOT, '777'));
    expect(miniAppDeviceId(BOT, '777')).not.toBe(miniAppDeviceId(BOT, '778'));
    expect(DEVICE_ID_PATTERN.test(miniAppDeviceId(BOT, '777'))).toBe(true);
  });
  it('keeps Telegram in an id space of its own', () => {
    expect(miniAppDeviceId(BOT, '777', 'telegram')).not.toBe(miniAppDeviceId(BOT, '777', 'bale'));
  });
  it('keeps the account ids of the first (Bale-only) release', () => {
    // The formula of the first release, written out: changing it would orphan every account made so far.
    expect(miniAppDeviceId(BOT, '777')).toBe(createHmac('sha256', BOT).update('dozari-bale-miniapp:777').digest('hex').slice(0, 32));
  });
});

describe('the mini-app uses the app\'s own authentication (D243)', () => {
  const repo: UserRepository = { async findByDeviceId() { return null; }, async findById() { return null; }, async createGuest() { throw new Error('unused'); }, async touch() {} };
  const mk = (token?: string) => buildServer({ auth: new AuthService(repo, createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3)), miniApp: { bale: token }, corsOrigin: 'https://app.example.ir' });

  it('has no messenger login endpoint any more', async () => {
    expect((await mk(BOT).inject({ method: 'POST', url: '/auth/miniapp', payload: { initData: 'x=1&hash=00' } })).statusCode).toBe(404);
  });
  it('answers the preflight of a sandboxed iframe (Origin: null) and of the mini-app domain, but not of a stranger', async () => {
    const preflight = async (app: ReturnType<typeof mk>, origin: string) =>
      (await app.inject({ method: 'OPTIONS', url: '/auth/guest', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } })).headers['access-control-allow-origin'];
    const on = mk(BOT);
    expect(await preflight(on, 'null')).toBe('null');
    expect(await preflight(on, 'https://app.example.ir')).toBe('https://app.example.ir');
    expect(await preflight(on, 'https://evil.example')).toBeUndefined();
    expect(await preflight(mk(), 'null')).toBeUndefined(); // no messenger token, no sandbox origin
  });
});
