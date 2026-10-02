import type { Session } from '@dozari/shared';
import { ApiError } from '../net/http';

/** Tiny async key/value store (the keychain on phones, localStorage on the web). */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const DEVICE_KEY = 'dozari.deviceId';
const TOKEN_KEY = 'dozari.token';

/** A random id of the shape the server accepts (`DEVICE_ID_PATTERN`): 32 hex characters. */
export function newDeviceId(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 32; i++) out += Math.floor(random() * 16).toString(16);
  return out;
}

export interface SessionDeps {
  store: KeyValueStore;
  login: (deviceId: string) => Promise<Session>;
  random?: () => number;
}

export interface SessionManager {
  /** The stored token if there is one, else a fresh guest login. Concurrent callers share one login. */
  token(): Promise<string>;
  /** Run an authorised call; on a 401 the token is dropped, a new guest session is made and the call retried once. */
  /** Forget this device's account: drop the token and the device id, so the next call starts a fresh guest. */
  forget(): Promise<void>;
  authed<T>(call: (token: string) => Promise<T>): Promise<T>;
}

export function createSessionManager(deps: SessionDeps): SessionManager {
  let pending: Promise<string> | null = null;

  async function fresh(): Promise<string> {
    let deviceId = await deps.store.get(DEVICE_KEY);
    if (!deviceId) {
      deviceId = newDeviceId(deps.random);
      await deps.store.set(DEVICE_KEY, deviceId);
    }
    const session = await deps.login(deviceId);
    await deps.store.set(TOKEN_KEY, session.token);
    return session.token;
  }

  async function token(): Promise<string> {
    if (!pending) {
      pending = (async () => (await deps.store.get(TOKEN_KEY)) ?? (await fresh()))().finally(() => {
        pending = null;
      });
    }
    return pending;
  }

  return {
    token,
    async forget() {
      await deps.store.remove(TOKEN_KEY);
      await deps.store.remove(DEVICE_KEY);
    },
    async authed(call) {
      try {
        return await call(await token());
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 401) throw err;
        await deps.store.remove(TOKEN_KEY);
        return call(await token());
      }
    },
  };
}
