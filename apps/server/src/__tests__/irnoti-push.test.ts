import { describe, expect, it } from 'vitest';
import { IrnotiPushService, irnotiPushFromEnv } from '../notify/irnoti-push.js';

const cfg = { appId: '7', apiKey: 'irnt_k' };
const recorder = (status = 200) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const http = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response('{}', { status });
  }) as unknown as typeof fetch;
  return { calls, http };
};

describe('IrnotiPushService', () => {
  it('sends to the player external id with the tag in extra', async () => {
    const { calls, http } = recorder();
    expect(await new IrnotiPushService(cfg, http).notify('user-1', { title: 'دوزاری', body: 'b', tag: 'inbox' })).toBe(true);
    expect(calls[0]!.url).toBe('https://api.irnoti.com/v1/sdk-apps/7/send');
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer irnt_k');
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ target: { externalIds: ['user-1'] }, message: { title: 'دوزاری', body: 'b', extra: { tag: 'inbox' } } });
  });
  it('honours a custom base URL', async () => {
    const { calls, http } = recorder();
    await new IrnotiPushService({ ...cfg, baseUrl: 'https://api.irnoti.ir/' }, http).notify('u', { title: 't', body: 'b', tag: 'x' });
    expect(calls[0]!.url).toBe('https://api.irnoti.ir/v1/sdk-apps/7/send');
  });
  it('falls back to the default host when the base URL env var is an empty string (compose passes it empty)', async () => {
    const urls: string[] = [];
    const http = (async (url: string) => (urls.push(url), new Response(JSON.stringify({ accepted: 1, total: 1 }), { status: 200 }))) as unknown as typeof fetch;
    await new IrnotiPushService({ ...cfg, baseUrl: '' }, http).notify('u', { title: 't', body: 'b', tag: 'x' });
    await irnotiPushFromEnv({ IRNOTI_PUSH_APP_ID: '1', IRNOTI_API_KEY: 'k', IRNOTI_BASE_URL: '  ' }, http)!.notify('u', { title: 't', body: 'b', tag: 'x' });
    expect(urls).toEqual(['https://api.irnoti.com/v1/sdk-apps/7/send', 'https://api.irnoti.com/v1/sdk-apps/1/send']);
  });

  it('reports a refusal and never throws when irnoti is down', async () => {
    expect(await new IrnotiPushService(cfg, recorder(403).http).notify('u', { title: 't', body: 'b', tag: 'x' })).toBe(false);
    const down = (async () => { throw new Error('down'); }) as unknown as typeof fetch;
    expect(await new IrnotiPushService(cfg, down).notify('u', { title: 't', body: 'b', tag: 'x' })).toBe(false);
  });
  it('logs a refusal, an empty send and an outage instead of staying silent', async () => {
    const logs: string[] = [];
    const log = (m: string) => logs.push(m);
    await new IrnotiPushService(cfg, recorder(401).http, log).notify('u1', { title: 't', body: 'b', tag: 'x' });
    const empty = (async () => new Response('{"total":0,"accepted":0,"failed":0}', { status: 200 })) as unknown as typeof fetch;
    await new IrnotiPushService(cfg, empty, log).notify('u2', { title: 't', body: 'b', tag: 'x' });
    const down = (async () => { throw new Error('down'); }) as unknown as typeof fetch;
    await new IrnotiPushService(cfg, down, log).notify('u3', { title: 't', body: 'b', tag: 'x' });
    expect(logs).toHaveLength(3);
    expect(logs[0]).toContain('HTTP 401');
    expect(logs[1]).toContain('reached no device');
    expect(logs[2]).toContain('down');
  });
  it('turns a live notice into one push and skips notices that are only useful in-app', async () => {
    const { calls, http } = recorder();
    const s = new IrnotiPushService(cfg, http);
    await s.notice('u', { kind: 'friend_request', from: 'علی' } as never);
    await s.notice('u', { kind: 'table_request' } as never);
    expect(calls).toHaveLength(1);
  });
  it('is off unless the app id and API key are set', () => {
    expect(irnotiPushFromEnv({ IRNOTI_API_KEY: 'k' })).toBeNull();
    expect(irnotiPushFromEnv({ IRNOTI_API_KEY: 'k', IRNOTI_PUSH_APP_ID: '1' })).not.toBeNull();
  });
});
