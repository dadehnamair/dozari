/** What the app tells us about itself on every call (headers set in apps/mobile/src/net/clientHeaders.ts). Sent by the client, so only ever shown to admins and never trusted for access. */
export interface ClientInfo {
  platform: 'android' | 'ios' | 'web';
  osVersion: string | null;
  appBuild: number | null;
  store: 'myket' | 'bazaar' | 'bale' | null;
}

type Headers = Record<string, string | string[] | undefined>;
const one = (h: Headers, k: string): string | undefined => {
  const v = h[k];
  return (Array.isArray(v) ? v[0] : v)?.trim();
};

/** Null when the platform header is missing or unknown (a browser, curl, an old app). */
export function parseClientInfo(h: Headers): ClientInfo | null {
  const platform = one(h, 'x-client-platform');
  if (platform !== 'android' && platform !== 'ios' && platform !== 'web') return null;
  const os = one(h, 'x-client-os');
  const build = Number(one(h, 'x-client-build'));
  const store = one(h, 'x-client-store');
  return {
    platform,
    osVersion: os && /^[\w.\- ]{1,24}$/.test(os) ? os : null,
    appBuild: Number.isInteger(build) && build > 0 && build < 1_000_000 ? build : null,
    store: store === 'myket' || store === 'bazaar' || store === 'bale' ? store : null,
  };
}

export interface ClientInfoStore {
  record(userId: string, info: ClientInfo): Promise<void>;
}

/** Writes at most once per half hour per account unless the details changed, so the extra work per request is a map lookup. */
export function createClientRecorder(store: ClientInfoStore, now: () => number = Date.now, everyMs = 30 * 60_000) {
  const seen = new Map<string, { sig: string; at: number }>();
  return async (userId: string, info: ClientInfo): Promise<void> => {
    const sig = `${info.platform}|${info.osVersion}|${info.appBuild}|${info.store}`;
    const prev = seen.get(userId);
    if (prev && prev.sig === sig && now() - prev.at < everyMs) return;
    if (seen.size > 20_000) seen.clear();
    seen.set(userId, { sig, at: now() });
    await store.record(userId, info);
  };
}
