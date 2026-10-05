import { itemSvg } from '@dozari/shared';
import type { LandingStore, NewCast, NewFaq, NewPost, PostRow } from './store.js';

/** A URL slug from a Persian or Latin title: letters and digits kept, spaces and `_` → `-`, everything else dropped, lower-cased. */
export function slugify(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s_‌]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

export const isSlug = (s: string): boolean => s.length >= 2 && s.length <= 120 && /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(s) && s === s.toLowerCase();

export type PostInput = { titleFa: string; summaryFa: string; bodyMd: string; slug?: string; metaTitle?: string | null; metaDescription?: string | null; coverUrl?: string | null; authorName?: string; status: 'draft' | 'published' };
export type PostResult = { ok: true; id: string; slug: string } | { ok: false; error: 'invalid_slug' | 'slug_taken' | 'invalid_cover' | 'not_found' | 'empty' };

const httpUrl = (s: string): boolean => /^https?:\/\//i.test(s);

export interface PublicPostSummary {
  slug: string;
  title: string;
  summary: string;
  coverUrl: string | null;
  author: string;
  publishedAt: number;
  updatedAt: number;
}
export interface PublicPost extends PublicPostSummary {
  bodyMd: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

const summaryOf = (p: PostRow): PublicPostSummary => ({ slug: p.slug, title: p.titleFa, summary: p.summaryFa, coverUrl: p.coverUrl, author: p.authorName, publishedAt: p.publishedAt ?? p.createdAt, updatedAt: p.updatedAt });

/** The blog, cast and FAQ of the landing site: what the admin writes and what the public API serves. */
export class LandingService {
  constructor(
    private readonly store: LandingStore,
    private readonly now: () => number = Date.now,
  ) {}

  async savePost(input: PostInput, id?: string): Promise<PostResult> {
    if (input.titleFa.trim().length < 2 || input.bodyMd.trim().length === 0) return { ok: false, error: 'empty' };
    if (input.coverUrl && !httpUrl(input.coverUrl)) return { ok: false, error: 'invalid_cover' };
    const slug = (input.slug && input.slug.trim() !== '' ? input.slug.trim().toLowerCase() : slugify(input.titleFa));
    if (!isSlug(slug)) return { ok: false, error: 'invalid_slug' };
    const base: NewPost = { slug, titleFa: input.titleFa.trim(), summaryFa: input.summaryFa.trim(), bodyMd: input.bodyMd, metaTitle: input.metaTitle?.trim() || null, metaDescription: input.metaDescription?.trim() || null, coverUrl: input.coverUrl?.trim() || null, authorName: input.authorName?.trim() ?? '', status: input.status };
    if (id === undefined) {
      const made = await this.store.createPost(base, this.now());
      return made === 'slug_taken' ? { ok: false, error: 'slug_taken' } : { ok: true, id: made.id, slug };
    }
    const out = await this.store.updatePost(id, base, this.now());
    return out === 'ok' ? { ok: true, id, slug } : { ok: false, error: out };
  }

  adminPosts() {
    return this.store.posts({ publishedOnly: false, limit: 200, offset: 0 });
  }

  adminPost(id: string) {
    return this.store.postById(id);
  }

  async publicPosts(page: number, pageSize: number): Promise<{ posts: PublicPostSummary[]; total: number; page: number; pageSize: number }> {
    const size = Math.min(Math.max(pageSize, 1), 50);
    const pg = Math.max(page, 1);
    const { rows, total } = await this.store.posts({ publishedOnly: true, limit: size, offset: (pg - 1) * size });
    return { posts: rows.map(summaryOf), total, page: pg, pageSize: size };
  }

  /** A published post, or the slug it moved to (answer it with a 301), or null (404). */
  async publicPost(slug: string): Promise<{ post: PublicPost } | { redirectTo: string } | null> {
    const p = await this.store.postBySlug(slug);
    if (p && p.status === 'published') return { post: { ...summaryOf(p), bodyMd: p.bodyMd, metaTitle: p.metaTitle, metaDescription: p.metaDescription } };
    const moved = await this.store.redirectFor(slug);
    return moved ? { redirectTo: moved } : null;
  }

  cast = {
    list: () => this.store.cast({ includeHidden: true }),
    publicList: () => this.store.cast({ includeHidden: false }),
    add: (c: NewCast) => this.store.addCast(c),
    update: (id: string, patch: Partial<NewCast & { sortOrder: number }>) => this.store.updateCast(id, patch),
  };

  /** The try-it puzzle of the landing: today's pick among the eligible approved puzzles, as four titled groups of four icons. */
  async publicDemo(): Promise<{ groups: { level: number; title: string; items: { name: string; svg: string }[] }[] } | null> {
    const day = Math.floor(this.now() / 86_400_000);
    const groups = await this.store.demoPuzzle((n) => day % n);
    return groups ? { groups: groups.map((g) => ({ level: g.level, title: g.titleFa, items: g.items.map((i) => ({ name: i.nameFa, svg: itemSvg(i.iconKey) })) })) } : null;
  }

  faq = {
    list: () => this.store.faq({ includeHidden: true }),
    publicList: () => this.store.faq({ includeHidden: false }),
    add: (f: NewFaq) => this.store.addFaq(f),
    update: (id: string, patch: Partial<NewFaq & { sortOrder: number }>) => this.store.updateFaq(id, patch),
  };
}
