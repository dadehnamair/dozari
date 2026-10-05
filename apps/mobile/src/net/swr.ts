import type { BigStore } from './bigStore';

/** A cached page older than this is not shown (prices, rankings and the shop change; a month-old board would only mislead). */
export const CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

interface Entry<T> {
  owner: string;
  savedAt: number;
  data: T;
}

export interface SwrDeps {
  store: BigStore;
  /** Tells accounts apart on a shared device, so one player never sees another's cached page. */
  owner: () => Promise<string>;
  now?: () => number;
}

/**
 * «Show what we had, then update it» (stale-while-revalidate) for the pages that rarely change.
 * `onData(data, fromCache)` fires once with the cached copy (if any and fresh enough), then once with the live one.
 * A failed refresh is silent while a cached copy is on screen; with nothing cached it goes to `onError`.
 * Returns a cancel function (call it when the screen goes away).
 */
export function createSwr(deps: SwrDeps) {
  const now = deps.now ?? Date.now;
  const storeKey = (key: string) => `dozari.cache.${key}`;

  async function read<T>(key: string, owner: string): Promise<T | null> {
    const raw = await deps.store.get(storeKey(key));
    if (!raw) return null;
    try {
      const e = JSON.parse(raw) as Entry<T>;
      if (e.owner !== owner || now() - e.savedAt > CACHE_MAX_AGE_MS) return null;
      return e.data;
    } catch {
      return null;
    }
  }

  async function save<T>(key: string, data: T): Promise<void> {
    let owner = '';
    try {
      owner = await deps.owner();
    } catch {
      return;
    }
    await deps.store.set(storeKey(key), JSON.stringify({ owner, savedAt: now(), data } satisfies Entry<T>));
  }

  /** A plain fetch that also keeps the result as the cached copy: for the reload after an action (a purchase, a claim), where showing the old copy first would mislead. */
  async function refresh<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const data = await fetcher();
    void save(key, data);
    return data;
  }

  function swr<T>(key: string, fetcher: () => Promise<T>, onData: (data: T, fromCache: boolean) => void, onError?: (err: unknown) => void): () => void {
    let alive = true;
    void (async () => {
      let shown = false;
      try {
        const owner = await deps.owner();
        const cached = await read<T>(key, owner);
        if (cached !== null && alive) {
          shown = true;
          onData(cached, true);
        }
      } catch {
        /* no cache: go straight to the network */
      }
      try {
        const fresh = await fetcher();
        if (!alive) return;
        onData(fresh, false);
        void save(key, fresh);
      } catch (err) {
        if (alive && !shown) onError?.(err);
      }
    })();
    return () => {
      alive = false;
    };
  }

  return Object.assign(swr, { refresh });
}
