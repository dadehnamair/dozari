import { describe, expect, it } from 'vitest';
import { IRNOTI_WEB_APP_ID_RE, IRNOTI_WEB_PUBLIC_KEY_RE, IrnotiWebPush } from '../notify/irnoti-web.js';
import type { SettingsStore } from '../settings/service.js';

const memoryStore = (): SettingsStore => {
  const m = new Map<string, string>();
  return { all: async () => Object.fromEntries(m), set: async (k, v) => void m.set(k, v), remove: async (k) => void m.delete(k) };
};
const recorder = () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const http = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response('{"total":1,"accepted":1}', { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, http };
};
const full = { publicKey: 'pk_live_e0b6f3ad5976fd0add1cace120e3b71a', appId: '12', apiKey: 'irnt_k' };

describe('IrnotiWebPush', () => {
  it('is off until public key, app id and API key are all set', async () => {
    const w = new IrnotiWebPush(memoryStore());
    expect((await w.adminState()).active).toBe(false);
    expect(await w.publicKey()).toBeNull();
    await w.update({ publicKey: full.publicKey, appId: full.appId });
    expect((await w.adminState()).active).toBe(false);
    await w.update({ apiKey: full.apiKey });
    expect((await w.adminState()).active).toBe(true);
    expect(await w.publicKey()).toBe(full.publicKey);
  });
  it('falls back to the env API key and never shows the key', async () => {
    const w = new IrnotiWebPush(memoryStore(), 'env-key-1234');
    await w.update({ publicKey: full.publicKey, appId: full.appId });
    const s = await w.adminState();
    expect(s).toMatchObject({ active: true, apiKeyFromEnv: true, apiKeyMask: '••••1234' });
    expect(JSON.stringify(s)).not.toContain('env-key');
  });
  it('removes a value with an empty string', async () => {
    const w = new IrnotiWebPush(memoryStore());
    await w.update(full);
    await w.update({ apiKey: '' });
    expect((await w.adminState()).active).toBe(false);
  });
  it('sends through the app with the player id, without a dozari:// deep link', async () => {
    const { calls, http } = recorder();
    const w = new IrnotiWebPush(memoryStore(), undefined, undefined, http);
    await w.update(full);
    expect(await w.notify('user-1', { title: 'دوزاری', body: 'b', tag: 'dm:x', deeplink: 'dozari://open/friends' })).toBe(true);
    expect(calls[0]!.url).toBe('https://api.irnoti.com/v1/sdk-apps/12/send');
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.target).toEqual({ externalIds: ['user-1'] });
    expect(body.message.deeplink).toBeUndefined();
  });
  it('does nothing when off, and only pushes what needs a person', async () => {
    const { calls, http } = recorder();
    const w = new IrnotiWebPush(memoryStore(), undefined, undefined, http);
    expect(await w.notify('u', { title: 't', body: 'b', tag: 'x' })).toBe(false);
    await w.update(full);
    await w.notice('u', { kind: 'inbox' } as never);
    expect(calls).toHaveLength(0);
    await w.notice('u', { kind: 'friend_request', from: 'علی' } as never);
    expect(calls).toHaveLength(1);
  });
  it('validates the panel values', () => {
    expect(IRNOTI_WEB_PUBLIC_KEY_RE.test(full.publicKey)).toBe(true);
    expect(IRNOTI_WEB_PUBLIC_KEY_RE.test('nope')).toBe(false);
    expect(IRNOTI_WEB_APP_ID_RE.test('12')).toBe(true);
    expect(IRNOTI_WEB_APP_ID_RE.test('12a')).toBe(false);
  });
});
