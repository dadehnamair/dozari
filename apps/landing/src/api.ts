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
  appUrl: string | null;
  domains: { app: string; landing: string; short: string };
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
    verify: { google: string | null; bing: string | null; yandex: string | null };
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

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

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
  async posts(page = 1, pageSize = 12): Promise<PostList> {
    return (await this.get<PostList>(`/public/posts?page=${page}&pageSize=${pageSize}`)) as PostList;
  }
  async post(slug: string): Promise<PostLookup> {
    return this.get<PostLookup>(`/public/posts/${encodeURIComponent(slug)}`, true);
  }
}
