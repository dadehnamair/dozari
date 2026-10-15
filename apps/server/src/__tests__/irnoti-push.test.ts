import { describe, expect, it, vi } from 'vitest';
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
  it('reports a refusal and never throws when irnoti is down', async () => {
    expect(await new IrnotiPushService(cfg, recorder(403).http).notify('u', { title: 't', body: 'b', tag: 'x' })).toBe(false);
    const down = (async () => { throw new Error('down'); }) as unknown as typeof fetch;
    expect(await new IrnotiPushService(cfg, down).notify('u', { title: 't', body: 'b', tag: 'x' })).toBe(false);
  });
  it('logs why irnoti refused the send', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await new IrnotiPushService(cfg, recorder(403).http).notify('u', { title: 't', body: 'b', tag: 'x' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('HTTP 403'));
    warn.mockRestore();
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
