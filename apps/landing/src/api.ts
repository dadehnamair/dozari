/** What `GET /public/*` of the game server returns (docs: apps/server/src/landing/routes.ts). */
export interface PublicSite {
  name: string;
  tagline: string;
  heroTitle: string;
  heroText: string;
  contactEmail: string | null;
  instagram: string | null;
  channel: string | null;
  androidApp: string | null;
  iosApp: string | null;
  /** Link of the Bale bot where the game can be played; null until the admin sets it. */
  baleBot?: string | null;
  /** Telegram mini-app link; null while the admin switch is off or the link is empty. */
  telegramApp?: string | null;
  appUrl: string | null;
  domains: { app: string; landing: string; short: string };
  /** Trust / store badges of the footer; `url` is null until the admin sets it. */
  badges?: { id: string; url: string | null }[];
  /** Everything the owner sets in the admin panel group «سئو و سایت معرفی». */
  seo: {
    title: string | null;
    description: string | null;
    keywords: string[];
    ogImage: string | null;
    ogImageAlt: string | null;
    sameAs: string[];
    fontUrl: string | null;
    indexable: boolean;
    verify: { google: string | null; bing: string | null; yandex: string | null; enamad?: string | null };
    /** Self-hosted analytics script (Umami style), or null. */
    analytics?: { scriptUrl: string; siteId: string } | null;
  };
}
export interface CastMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  image: string | null;
}
export interface FaqPair {
  question: string;
  answer: string;
}
export interface LandingData {
  site: PublicSite;
  cast: CastMember[];
  faq: FaqPair[];
}
/** The try-it puzzle: groups in difficulty order (level 0 = easiest), each item an icon drawn by the game server. */
export interface DemoPuzzle {
  groups: { level: number; title: string; items: { name: string; svg: string; image: string | null }[] }[];
}
export interface PostSummary {
  slug: string;
  title: string;
  summary: string;
  coverUrl: string | null;
  author: string;
  publishedAt: number;
  updatedAt: number;
}
export interface Post extends PostSummary {
  bodyMd: string;
  metaTitle: string | null;
  metaDescription: string | null;
}
export interface PostList {
  posts: PostSummary[];
  total: number;
  page: number;
  pageSize: number;
}
export type PostLookup = { post: Post } | { redirectTo: string } | null;

/** Aggregate numbers of `GET /public/stats`. */
export interface SiteStats {
  players: number;
  products: number;
  prices: number;
  puzzles: number;
  provinces: number;
  years: { from: number; to: number } | null;
  posts: number;
  at: number;
}
/** `GET /public/status`: what the game server says about itself. */
export interface ServerStatus {
  api: 'ok';
  db: 'ok' | 'down';
  dbMs: number;
  maintenance: boolean;
  uptimeSec: number;
  at: number;
}
export type CommentTarget = 'post' | 'cast';
export interface PublicComment {
  id: string;
  author: string;
  body: string;
  createdAt: number;
}
export type CommentOutcome = { ok: true } | { ok: false; error: string };

type Fetch = (url: string, init?: { signal?: AbortSignal; method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * Client of the game server's read-only content API with a short in-memory cache. When the server cannot be reached the last good
 * answer is served (stale), and only a cold failure surfaces, so the landing site survives a game-server restart.
 */
export class ContentApi {
  private readonly cache = new Map<string, { at: number; value: unknown }>();
  constructor(
    private readonly base: string,
    private readonly fetcher: Fetch = fetch as unknown as Fetch,
    private readonly ttlMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  private async get<T>(path: string, accept404 = false): Promise<T | null> {
    const hit = this.cache.get(path);
    if (hit && this.now() - hit.at < this.ttlMs) return hit.value as T | null;
    try {
      const res = await this.fetcher(`${this.base}${path}`, { signal: AbortSignal.timeout(5000) });
      if (res.status === 404 && accept404) {
        this.cache.set(path, { at: this.now(), value: null });
        return null;
      }
      if (!res.ok) throw new Error(`api ${res.status}`);
      const value = (await res.json()) as T;
      this.cache.set(path, { at: this.now(), value });
      return value;
    } catch (err) {
      if (hit) return hit.value as T | null;
      throw err;
    }
  }

  async landing(): Promise<LandingData> {
    return (await this.get<LandingData>('/public/landing')) as LandingData;
  }
  /** The catalog-backed try-it puzzle, or null when the server has none (or cannot say): the page then shows its static one. */
  async demo(): Promise<DemoPuzzle | null> {
    try {
      return await this.get<DemoPuzzle>('/public/landing-demo', true);
    } catch {
      return null;
    }
  }
  async posts(page = 1, pageSize = 12): Promise<PostList> {
    return (await this.get<PostList>(`/public/posts?page=${page}&pageSize=${pageSize}`)) as PostList;
  }
  async stats(): Promise<SiteStats | null> {
    try {
      return await this.get<SiteStats>('/public/stats');
    } catch {
      return null;
    }
  }
  /** A live probe (never cached): the status page must show what is true now, so a failure is a result, not an exception. */
  async probe(): Promise<{ reachable: boolean; ms: number; status: ServerStatus | null }> {
    const t0 = this.now();
    try {
      const res = await this.fetcher(`${this.base}/public/status`, { signal: AbortSignal.timeout(5000) });
      const ms = this.now() - t0;
      if (!res.ok) return { reachable: true, ms, status: null };
      return { reachable: true, ms, status: (await res.json()) as ServerStatus };
    } catch {
      return { reachable: false, ms: this.now() - t0, status: null };
    }
  }
  /** Approved comments of a post or cast member; an unreachable server just means «no comments shown». */
  async comments(type: CommentTarget, key: string): Promise<PublicComment[]> {
    try {
      return (await this.get<{ comments: PublicComment[] }>(`/public/comments?type=${type}&key=${encodeURIComponent(key)}`))?.comments ?? [];
    } catch {
      return [];
    }
  }
  async commentCounts(type: CommentTarget): Promise<Record<string, number>> {
    try {
      return (await this.get<{ counts: Record<string, number> }>(`/public/comment-counts?type=${type}`))?.counts ?? {};
    } catch {
      return {};
    }
  }
  /** Forwards a visitor's comment to the game server (it is held for approval there). */
  async submitComment(c: { type: CommentTarget; key: string; name: string; body: string }, visitor: string): Promise<CommentOutcome> {
    try {
      const res = await this.fetcher(`${this.base}/public/comments`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-visitor': visitor }, body: JSON.stringify(c), signal: AbortSignal.timeout(5000) });
      if (res.ok) return { ok: true };
      const err = ((await res.json().catch(() => ({}))) as { error?: string }).error;
      return { ok: false, error: res.status === 429 ? 'rate_limited' : (err ?? 'failed') };
    } catch {
      return { ok: false, error: 'unavailable' };
    }
  }
  async post(slug: string): Promise<PostLookup> {
    return this.get<PostLookup>(`/public/posts/${encodeURIComponent(slug)}`, true);
  }
}
