import type { KeyValueStore } from '../auth/session';

/** One stored piece stays well under the size where a keychain starts to refuse or truncate a value. */
const CHUNK = 1500;

/**
 * A key/value store for values bigger than the keychain likes (cached pages, saved puzzles): the text is cut into
 * pieces under `key.0`, `key.1` … plus a `key.n` count, and written count-last so a half-written value is never read.
 * Never throws; a missing or broken value reads as null.
 */
export function createBigStore(store: KeyValueStore) {
  return {
    async get(key: string): Promise<string | null> {
      try {
        const n = Number(await store.get(`${key}.n`));
        if (!Number.isInteger(n) || n < 1 || n > 4000) return null;
        let out = '';
        for (let i = 0; i < n; i++) {
          const part = await store.get(`${key}.${i}`);
          if (part === null) return null;
          out += part;
        }
        return out;
      } catch {
        return null;
      }
    },
    async set(key: string, value: string): Promise<void> {
      try {
        const old = Number(await store.get(`${key}.n`));
        const parts = Math.max(1, Math.ceil(value.length / CHUNK));
        for (let i = 0; i < parts; i++) await store.set(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
        await store.set(`${key}.n`, String(parts));
        for (let i = parts; Number.isInteger(old) && i < old; i++) await store.remove(`${key}.${i}`);
      } catch {
        /* a cache is a nicety */
      }
    },
    async remove(key: string): Promise<void> {
      try {
        const n = Number(await store.get(`${key}.n`));
        await store.remove(`${key}.n`);
        for (let i = 0; Number.isInteger(n) && i < n; i++) await store.remove(`${key}.${i}`);
      } catch {
        /* a cache is a nicety */
      }
    },
  };
}
export type BigStore = ReturnType<typeof createBigStore>;
