/**
 * Read-only view of the app's releases on CafeBazaar, through the Pishkhan API (docs: BAZAAR-PISHKHAN-API.md in the repo root).
 * Only the three GET endpoints are called; uploading, committing and deleting releases stay in the Bazaar panel or CI. The token is
 * per app and comes from `BAZAAR_PISHKHAN_TOKEN`. Answers are cached (the API answers 429 when asked too often).
 */
export interface BazaarPackage {
  versionCode: number | null;
  versionName: string | null;
  apkSize: number | null;
  apiLevel: number | null;
  targetApiLevel: number | null;
  uploadDate: string | null;
  cpu: string | null;
}

export interface BazaarRelease {
  creationDate: string | null;
  packages: BazaarPackage[];
  autoPublish: boolean | null;
  stagedRolloutPercentage: number | null;
  changelogFa: string | null;
  changelogEn: string | null;
}

/** `release` is null when Bazaar answered `not-exists` (no such release yet); `error` is set when the call itself failed. */
export interface BazaarSlot {
  release: BazaarRelease | null;
  error: string | null;
}

export interface BazaarStatus {
  configured: boolean;
  checkedAt: number | null;
  published: BazaarSlot | null;
  committed: BazaarSlot | null;
  uncommitted: BazaarSlot | null;
}

const BASE = 'https://api.pishkhan.cafebazaar.ir/v1/apps/releases';
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Pure: maps one Pishkhan answer to a slot. */
export function parseBazaarAnswer(status: number, body: unknown): BazaarSlot {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (status === 403) return { release: null, error: 'توکن پیشخان نامعتبر است' };
  if (status === 429) return { release: null, error: 'درخواست بیش از حد به بازار؛ کمی بعد دوباره' };
  if (status < 200 || status >= 300) return { release: null, error: typeof b.message === 'string' ? b.message.slice(0, 200) : `خطای ${status}` };
  if (b.type === 'not-exists') return { release: null, error: null };
  const r = (b.release && typeof b.release === 'object' ? b.release : null) as Record<string, unknown> | null;
  if (!r) return { release: null, error: null };
  const packages = (Array.isArray(r.packages) ? r.packages : []).map((p): BazaarPackage => {
    const x = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
    return { versionCode: int(x.version_code), versionName: str(x.version_name), apkSize: int(x.apk_size), apiLevel: int(x.api_level), targetApiLevel: int(x.target_api_level), uploadDate: str(x.upload_date), cpu: str(x.cpu_architectures) };
  });
  return {
    error: null,
    release: {
      creationDate: str(r.creation_date),
      packages,
      autoPublish: typeof r.auto_publish === 'boolean' ? r.auto_publish : null,
      stagedRolloutPercentage: int(r.staged_rollout_percentage),
      changelogFa: str(r.changelog_fa),
      changelogEn: str(r.changelog_en),
    },
  };
}

export interface BazaarMonitorOptions {
  token: string | undefined;
  fetchImpl?: typeof fetch;
  now?: () => number;
  ttlMs?: number;
}

export function createBazaarMonitor(opts: BazaarMonitorOptions) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const ttl = opts.ttlMs ?? 5 * 60_000;
  let cache: BazaarStatus | null = null;

  const ask = async (path: string): Promise<BazaarSlot> => {
    try {
      const res = await fetchImpl(`${BASE}/${path}/`, { headers: { 'CAFEBAZAAR-PISHKHAN-API-SECRET': opts.token! }, signal: AbortSignal.timeout(8000) });
      const body = await res.json().catch(() => null);
      return parseBazaarAnswer(res.status, body);
    } catch {
      return { release: null, error: 'پاسخی از بازار نیامد' };
    }
  };

  return {
    async status(): Promise<BazaarStatus> {
      if (!opts.token) return { configured: false, checkedAt: null, published: null, committed: null, uncommitted: null };
      if (cache && now() - (cache.checkedAt ?? 0) < ttl) return cache;
      const [published, committed, uncommitted] = await Promise.all([ask('last-published'), ask('last-committed'), ask('last-uncommitted')]);
      cache = { configured: true, checkedAt: now(), published, committed, uncommitted };
      return cache;
    },
  };
}
export type BazaarMonitor = ReturnType<typeof createBazaarMonitor>;
