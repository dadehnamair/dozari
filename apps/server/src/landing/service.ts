import { itemSvg } from '@dozari/shared';
import type { CommentStatus, CommentTarget, LandingStore, NewCast, NewFaq, NewPost, PostRow, SiteStats } from './store.js';

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

export interface PublicComment {
  id: string;
  author: string;
  body: string;
  createdAt: number;
}
export type CommentResult = { ok: true; status: 'pending' } | { ok: false; error: 'invalid_name' | 'invalid_body' | 'links_not_allowed' | 'blocked_word' | 'not_found' };
/** The text gate shared with player chat (`TextFilterService.check`); optional so tests can run without it. */
export type CommentFilter = (text: string) => Promise<{ ok: true; text: string } | { ok: false }>;

const LINK_RE = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|ir|net|org|io|me|info)\b|@\w{3,}/i;

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
    private readonly filter?: CommentFilter,
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

  /** The stats page: real aggregate numbers only. */
  stats(): Promise<SiteStats> {
    return this.store.stats();
  }

  /** Is `key` a published post slug or an active cast id? Comments are only accepted for things that exist. */
  private async targetExists(type: CommentTarget, key: string): Promise<boolean> {
    if (type === 'post') {
      const p = await this.store.postBySlug(key);
      return !!p && p.status === 'published';
    }
    return (await this.store.cast({ includeHidden: false })).some((c) => c.id === key);
  }

  /** Approved comments of one post or cast member, newest first. */
  async publicComments(type: CommentTarget, key: string): Promise<PublicComment[]> {
    const rows = await this.store.comments({ targetType: type, targetKey: key, status: 'approved', limit: 100 });
    return rows.map((c) => ({ id: c.id, author: c.authorName, body: c.body, createdAt: c.createdAt }));
  }

  /** How many approved comments each post slug / cast id has. */
  approvedCommentCounts(type: CommentTarget): Promise<Record<string, number>> {
    return this.store.commentCounts(type, 'approved');
  }

  /** A visitor's comment: checked, then held `pending` until an admin approves it (no links, no blocked words). */
  async submitComment(input: { targetType: CommentTarget; targetKey: string; authorName: string; body: string }): Promise<CommentResult> {
    const name = input.authorName.replace(/\s+/g, ' ').trim();
    const body = input.body.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (name.length < 2 || name.length > 60) return { ok: false, error: 'invalid_name' };
    if (body.length < 3 || body.length > 1000) return { ok: false, error: 'invalid_body' };
    if (LINK_RE.test(name) || LINK_RE.test(body)) return { ok: false, error: 'links_not_allowed' };
    if (!(await this.targetExists(input.targetType, input.targetKey))) return { ok: false, error: 'not_found' };
    let cleanBody = body;
    let cleanName = name;
    if (this.filter) {
      const [b, n] = await Promise.all([this.filter(body), this.filter(name)]);
      if (!b.ok || !n.ok) return { ok: false, error: 'blocked_word' };
      cleanBody = b.text;
      cleanName = n.text;
    }
    await this.store.addComment({ targetType: input.targetType, targetKey: input.targetKey, authorName: cleanName, body: cleanBody, status: 'pending' }, this.now());
    return { ok: true, status: 'pending' };
  }

  adminComments(status?: CommentStatus) {
    return this.store.comments({ status, limit: 200 });
  }

  setCommentStatus(id: string, status: CommentStatus) {
    return this.store.setCommentStatus(id, status);
  }

  cast = {
    list: () => this.store.cast({ includeHidden: true }),
    publicList: () => this.store.cast({ includeHidden: false }),
    add: (c: NewCast) => this.store.addCast(c),
    update: (id: string, patch: Partial<NewCast & { sortOrder: number }>) => this.store.updateCast(id, patch),
  };

  /** The try-it puzzle of the landing: today's pick among the eligible approved puzzles, as four titled groups of four icons. */
  async publicDemo(): Promise<{ groups: { level: number; title: string; items: { name: string; svg: string; image: string | null }[] }[] } | null> {
    const day = Math.floor(this.now() / 86_400_000);
    const groups = await this.store.demoPuzzle((n) => day % n);
    return groups ? { groups: groups.map((g) => ({ level: g.level, title: g.titleFa, items: g.items.map((i) => ({ name: i.nameFa, svg: itemSvg(i.iconKey), image: i.imageUrl && /^https?:\/\//.test(i.imageUrl) ? i.imageUrl : null })) })) } : null;
  }

  faq = {
    list: () => this.store.faq({ includeHidden: true }),
    publicList: () => this.store.faq({ includeHidden: false }),
    add: (f: NewFaq) => this.store.addFaq(f),
    update: (id: string, patch: Partial<NewFaq & { sortOrder: number }>) => this.store.updateFaq(id, patch),
  };
}
