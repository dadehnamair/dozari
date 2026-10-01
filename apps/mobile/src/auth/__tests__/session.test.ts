import { describe, expect, it } from 'vitest';
import { DEVICE_ID_PATTERN } from '@dozari/shared';
import { createSessionManager, newDeviceId } from '../session';
import { ApiError } from '../../net/http';
import type { KeyValueStore } from '../session';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    get: async (k) => data[k] ?? null,
    set: async (k, v) => {
      data[k] = v;
    },
    remove: async (k) => {
      delete data[k];
    },
  };
}
const session = (token: string) => ({ token, user: { id: '0190a000-0000-7000-8000-000000000001', nickname: 'x', avatarKey: 'avatar-01' } });

describe('session manager', () => {
  it('makes device ids the server accepts', () => {
    expect(DEVICE_ID_PATTERN.test(newDeviceId())).toBe(true);
    expect(newDeviceId()).not.toBe(newDeviceId());
  });

  it('logs in once, remembers the device and token, and shares a concurrent login', async () => {
    const store = memoryStore();
    let logins = 0;
    const m = createSessionManager({ store, login: async () => session(`t${++logins}`) });
    const [a, b] = await Promise.all([m.token(), m.token()]);
    expect([a, b]).toEqual(['t1', 't1']);
    expect(logins).toBe(1);
    expect(store.data['dozari.deviceId']).toMatch(DEVICE_ID_PATTERN);
    expect(await m.token()).toBe('t1');
    expect(logins).toBe(1);
  });

  it('keeps the same device id when it has to log in again', async () => {
    const store = memoryStore({ 'dozari.deviceId': 'abcdef0123456789abcdef0123456789' });
    const seen: string[] = [];
    const m = createSessionManager({ store, login: async (d) => (seen.push(d), session('t')) });
    await m.token();
    expect(seen).toEqual(['abcdef0123456789abcdef0123456789']);
  });

  it('retries once with a new session after a 401, but not for other errors', async () => {
    const store = memoryStore({ 'dozari.token': 'stale', 'dozari.deviceId': 'abcdef0123456789abcdef0123456789' });
    const m = createSessionManager({ store, login: async () => session('fresh') });
    const used: string[] = [];
    const out = await m.authed(async (t) => {
      used.push(t);
      if (t === 'stale') throw new ApiError(401, 'unauthorized');
      return 'ok';
    });
    expect(out).toBe('ok');
    expect(used).toEqual(['stale', 'fresh']);
    await expect(m.authed(async () => { throw new ApiError(500, 'boom'); })).rejects.toThrow('500');
  });
});
