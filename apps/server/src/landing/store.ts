import { and, asc, cities, dailyPuzzles, desc, eq, landingCast, landingComments, landingFaq, landingPosts, landingSlugRedirects, pricePoints, productImages, products, puzzleGroupItems, puzzleGroups, puzzles, sql, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';

export interface PostRow {
  id: string;
  slug: string;
  titleFa: string;
  summaryFa: string;
  bodyMd: string;
  metaTitle: string | null;
  metaDescription: string | null;
  coverUrl: string | null;
  authorName: string;
  status: 'draft' | 'published';
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
}
export type NewPost = Omit<PostRow, 'id' | 'publishedAt' | 'createdAt' | 'updatedAt'>;

export interface CastRow {
  id: string;
  nameFa: string;
  roleFa: string;
  bioFa: string;
  imageKey: string | null;
  sortOrder: number;
  isActive: boolean;
}
export type NewCast = Omit<CastRow, 'id' | 'sortOrder'>;

export interface FaqRow {
  id: string;
  questionFa: string;
  answerFa: string;
  sortOrder: number;
  isActive: boolean;
}
export type NewFaq = Omit<FaqRow, 'id' | 'sortOrder'>;


export type CommentTarget = 'post' | 'cast';
export type CommentStatus = 'pending' | 'approved' | 'hidden';
export interface CommentRow {
  id: string;
  targetType: CommentTarget;
  targetKey: string;
  authorName: string;
  body: string;
  status: CommentStatus;
  createdAt: number;
}
export type NewComment = Pick<CommentRow, 'targetType' | 'targetKey' | 'authorName' | 'body' | 'status'>;

/** Real, aggregate-only numbers for the public stats page. */
export interface SiteStats {
  players: number;
  products: number;
  prices: number;
  puzzles: number;
  provinces: number;
  /** Solar Hijri year range covered by approved prices; null while there are none. */
  years: { from: number; to: number } | null;
  posts: number;
}

/** One approved puzzle for the landing's try-it demo: four groups of four products that all have an icon. */
export interface DemoGroupRow {
  level: number;
  titleFa: string;
  items: { nameFa: string; iconKey: string; imageUrl: string | null }[];
}

/** I/O boundary of the landing content (blog, cast, FAQ). */
export interface LandingStore {
  posts(opts: { publishedOnly: boolean; limit: number; offset: number }): Promise<{ rows: PostRow[]; total: number }>;
  postBySlug(slug: string): Promise<PostRow | null>;
  postById(id: string): Promise<PostRow | null>;
  /** The slug a renamed post used to have → its current slug. */
  redirectFor(oldSlug: string): Promise<string | null>;
  createPost(p: NewPost, now: number): Promise<PostRow | 'slug_taken'>;
  /** Updates a post; a changed slug keeps the old one as a redirect. */
  updatePost(id: string, patch: Partial<NewPost>, now: number): Promise<'ok' | 'not_found' | 'slug_taken'>;
  cast(opts: { includeHidden: boolean }): Promise<CastRow[]>;
  addCast(c: NewCast): Promise<CastRow>;
  updateCast(id: string, patch: Partial<NewCast & { sortOrder: number }>): Promise<'ok' | 'not_found'>;
  faq(opts: { includeHidden: boolean }): Promise<FaqRow[]>;
  addFaq(f: NewFaq): Promise<FaqRow>;
  updateFaq(id: string, patch: Partial<NewFaq & { sortOrder: number }>): Promise<'ok' | 'not_found'>;
  addComment(c: NewComment, now: number): Promise<CommentRow>;
  comments(opts: { targetType?: CommentTarget; targetKey?: string; status?: CommentStatus; limit: number }): Promise<CommentRow[]>;
  commentCounts(targetType: CommentTarget, status: CommentStatus): Promise<Record<string, number>>;
  setCommentStatus(id: string, status: CommentStatus): Promise<'ok' | 'not_found'>;
  stats(): Promise<SiteStats>;
  /** An approved adult puzzle whose 16 products all have icons and that is not a daily puzzle (no spoilers); `pick` chooses among the candidates. */
  demoPuzzle(pick: (n: number) => number): Promise<DemoGroupRow[] | null>;
}

const toPost = (r: typeof landingPosts.$inferSelect): PostRow => ({ ...r, publishedAt: r.publishedAt ? r.publishedAt.getTime() : null, createdAt: r.createdAt.getTime(), updatedAt: r.updatedAt.getTime() });

export function createDbLandingStore(db: Db): LandingStore {
  return {
    async posts({ publishedOnly, limit, offset }) {
      const where = publishedOnly ? eq(landingPosts.status, 'published') : undefined;
      const rows = await db.select().from(landingPosts).where(where).orderBy(desc(landingPosts.publishedAt), desc(landingPosts.createdAt)).limit(limit).offset(offset);
      const [c] = await db.select({ n: sql<number>`COUNT(*)` }).from(landingPosts).where(where);
      return { rows: rows.map(toPost), total: Number(c?.n ?? 0) };
    },
    async postBySlug(slug) {
      const [r] = await db.select().from(landingPosts).where(eq(landingPosts.slug, slug));
      return r ? toPost(r) : null;
    },
    async postById(id) {
      const [r] = await db.select().from(landingPosts).where(eq(landingPosts.id, id));
      return r ? toPost(r) : null;
    },
    async redirectFor(oldSlug) {
      const [r] = await db.select({ slug: landingPosts.slug }).from(landingSlugRedirects).innerJoin(landingPosts, eq(landingPosts.id, landingSlugRedirects.postId)).where(and(eq(landingSlugRedirects.oldSlug, oldSlug), eq(landingPosts.status, 'published')));
      return r?.slug ?? null;
    },
    async createPost(p, now) {
      const id = uuidv7();
      const [res] = await db.insert(landingPosts).ignore().values({ ...p, id, publishedAt: p.status === 'published' ? new Date(now) : null, createdAt: new Date(now), updatedAt: new Date(now) });
      if (res.affectedRows < 1) return 'slug_taken';
      return (await this.postById(id))!;
    },
    async updatePost(id, patch, now) {
      const cur = await this.postById(id);
      if (!cur) return 'not_found';
      if (patch.slug && patch.slug !== cur.slug) {
        const [taken] = await db.select({ id: landingPosts.id }).from(landingPosts).where(eq(landingPosts.slug, patch.slug));
        if (taken) return 'slug_taken';
      }
      await db.transaction(async (tx) => {
        const set: Partial<typeof landingPosts.$inferInsert> = { ...patch, updatedAt: new Date(now) };
        if (patch.status === 'published' && cur.publishedAt === null) set.publishedAt = new Date(now);
        await tx.update(landingPosts).set(set).where(eq(landingPosts.id, id));
        if (patch.slug && patch.slug !== cur.slug) {
          await tx.insert(landingSlugRedirects).ignore().values({ oldSlug: cur.slug, postId: id });
          // The new slug must not stay behind as a redirect to itself.
          await tx.delete(landingSlugRedirects).where(eq(landingSlugRedirects.oldSlug, patch.slug));
        }
      });
      return 'ok';
    },
    async cast({ includeHidden }) {
      const rows = await db.select().from(landingCast).where(includeHidden ? undefined : eq(landingCast.isActive, true)).orderBy(asc(landingCast.sortOrder), asc(landingCast.id));
      return rows.map((r) => ({ ...r }));
    },
    async addCast(c) {
      const [agg] = await db.select({ top: sql<number>`COALESCE(MAX(${landingCast.sortOrder}), 0)` }).from(landingCast);
      const row = { ...c, id: uuidv7(), sortOrder: Number(agg?.top ?? 0) + 1 };
      await db.insert(landingCast).values(row);
      return row;
    },
    async updateCast(id, patch) {
      const [r] = await db.select({ id: landingCast.id }).from(landingCast).where(eq(landingCast.id, id));
      if (!r) return 'not_found';
      if (Object.keys(patch).length > 0) await db.update(landingCast).set(patch).where(eq(landingCast.id, id));
      return 'ok';
    },
    async faq({ includeHidden }) {
      const rows = await db.select().from(landingFaq).where(includeHidden ? undefined : eq(landingFaq.isActive, true)).orderBy(asc(landingFaq.sortOrder), asc(landingFaq.id));
      return rows.map((r) => ({ ...r }));
    },
    async addFaq(f) {
      const [agg] = await db.select({ top: sql<number>`COALESCE(MAX(${landingFaq.sortOrder}), 0)` }).from(landingFaq);
      const row = { ...f, id: uuidv7(), sortOrder: Number(agg?.top ?? 0) + 1 };
      await db.insert(landingFaq).values(row);
      return row;
    },
    async updateFaq(id, patch) {
      const [r] = await db.select({ id: landingFaq.id }).from(landingFaq).where(eq(landingFaq.id, id));
      if (!r) return 'not_found';
      if (Object.keys(patch).length > 0) await db.update(landingFaq).set(patch).where(eq(landingFaq.id, id));
      return 'ok';
    },
    async addComment(c, now) {
      const row = { ...c, id: uuidv7(), createdAt: now };
      await db.insert(landingComments).values({ ...row, createdAt: new Date(now) });
      return row;
    },
    async comments({ targetType, targetKey, status, limit }) {
      const conds = [targetType ? eq(landingComments.targetType, targetType) : undefined, targetKey ? eq(landingComments.targetKey, targetKey) : undefined, status ? eq(landingComments.status, status) : undefined].filter((x) => x !== undefined);
      const rows = await db.select().from(landingComments).where(conds.length ? and(...conds) : undefined).orderBy(desc(landingComments.createdAt)).limit(limit);
      return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() }));
    },
    async commentCounts(targetType, status) {
      const rows = await db.select({ k: landingComments.targetKey, n: sql<number>`COUNT(*)` }).from(landingComments).where(and(eq(landingComments.targetType, targetType), eq(landingComments.status, status))).groupBy(landingComments.targetKey);
      return Object.fromEntries(rows.map((r) => [r.k, Number(r.n)]));
    },
    async setCommentStatus(id, status) {
      const [res] = await db.update(landingComments).set({ status }).where(eq(landingComments.id, id));
      return res.affectedRows < 1 ? 'not_found' : 'ok';
    },
    async stats() {
      const one = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
      const [players, prods, prices, pz, provinces, posts, [range]] = await Promise.all([
        one(db.select({ n: sql<number>`COUNT(*)` }).from(users).where(eq(users.isBanned, false))),
        one(db.select({ n: sql<number>`COUNT(*)` }).from(products).where(eq(products.isActive, true))),
        one(db.select({ n: sql<number>`COUNT(*)` }).from(pricePoints).where(eq(pricePoints.status, 'approved'))),
        one(db.select({ n: sql<number>`COUNT(*)` }).from(puzzles).where(eq(puzzles.status, 'approved'))),
        one(db.select({ n: sql<number>`COUNT(*)` }).from(cities)),
        one(db.select({ n: sql<number>`COUNT(*)` }).from(landingPosts).where(eq(landingPosts.status, 'published'))),
        db.select({ lo: sql<number | null>`MIN(${pricePoints.year})`, hi: sql<number | null>`MAX(${pricePoints.year})` }).from(pricePoints).where(eq(pricePoints.status, 'approved')),
      ]);
      return { players, products: prods, prices, puzzles: pz, provinces, years: range?.lo != null && range.hi != null ? { from: Number(range.lo), to: Number(range.hi) } : null, posts };
    },
    async demoPuzzle(pick) {
      const candidates = await db
        .select({ id: puzzles.id })
        .from(puzzles)
        .innerJoin(puzzleGroupItems, eq(puzzleGroupItems.puzzleId, puzzles.id))
        .innerJoin(products, eq(products.id, puzzleGroupItems.productId))
        .where(and(eq(puzzles.status, 'approved'), eq(puzzles.ageTrack, 'adult'), sql`${puzzles.id} NOT IN (SELECT ${dailyPuzzles.puzzleId} FROM ${dailyPuzzles})`))
        .groupBy(puzzles.id)
        .having(sql`COUNT(*) = 16 AND SUM(${products.iconKey} IS NULL) = 0`)
        .orderBy(asc(puzzles.id))
        .limit(50);
      if (candidates.length === 0) return null;
      const chosen = candidates[Math.min(Math.max(pick(candidates.length), 0), candidates.length - 1)]!.id;
      const rows = await db
        .select({
          level: puzzleGroups.level,
          titleFa: puzzleGroups.titleFa,
          nameFa: products.nameFa,
          iconKey: products.iconKey,
          // The primary photo, else the oldest one; only absolute web addresses (the landing is another origin).
          imageUrl: sql<string | null>`(SELECT ${productImages.url} FROM ${productImages} WHERE ${productImages.productId} = ${products.id} AND ${productImages.url} LIKE 'http%' ORDER BY ${productImages.isPrimary} DESC, ${productImages.createdAt} ASC LIMIT 1)`,
        })
        .from(puzzleGroups)
        .innerJoin(puzzleGroupItems, eq(puzzleGroupItems.groupId, puzzleGroups.id))
        .innerJoin(products, eq(products.id, puzzleGroupItems.productId))
        .where(eq(puzzleGroups.puzzleId, chosen))
        .orderBy(asc(puzzleGroups.level), asc(products.id));
      const byLevel = new Map<number, DemoGroupRow>();
      for (const r of rows) {
        if (!r.titleFa || !r.iconKey) return null;
        const g = byLevel.get(r.level) ?? { level: r.level, titleFa: r.titleFa, items: [] };
        g.items.push({ nameFa: r.nameFa, iconKey: r.iconKey, imageUrl: r.imageUrl });
        byLevel.set(r.level, g);
      }
      const groups = [...byLevel.values()];
      return groups.length === 4 && groups.every((g) => g.items.length === 4) ? groups : null;
    },
  };
}

/** In-memory twin for tests. */
export function createMemoryLandingStore(): LandingStore {
  const posts: PostRow[] = [];
  const redirects = new Map<string, string>();
  const cast: CastRow[] = [];
  const faq: FaqRow[] = [];
  const comments: CommentRow[] = [];
  const nid = (n: number, p: string) => `00000000-0000-7000-${p}-${String(n).padStart(12, '0')}`;
  return {
    async posts({ publishedOnly, limit, offset }) {
      const all = posts.filter((p) => !publishedOnly || p.status === 'published').sort((a, b) => (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt));
      return { rows: all.slice(offset, offset + limit).map((p) => ({ ...p })), total: all.length };
    },
    async postBySlug(slug) {
      const p = posts.find((x) => x.slug === slug);
      return p ? { ...p } : null;
    },
    async postById(id) {
      const p = posts.find((x) => x.id === id);
      return p ? { ...p } : null;
    },
    async redirectFor(oldSlug) {
      const id = redirects.get(oldSlug);
      const p = posts.find((x) => x.id === id && x.status === 'published');
      return p?.slug ?? null;
    },
    async createPost(p, now) {
      if (posts.some((x) => x.slug === p.slug)) return 'slug_taken';
      const row: PostRow = { ...p, id: nid(posts.length + 1, 'a000'), publishedAt: p.status === 'published' ? now : null, createdAt: now, updatedAt: now };
      posts.push(row);
      return { ...row };
    },
    async updatePost(id, patch, now) {
      const cur = posts.find((x) => x.id === id);
      if (!cur) return 'not_found';
      if (patch.slug && patch.slug !== cur.slug && posts.some((x) => x.slug === patch.slug)) return 'slug_taken';
      if (patch.slug && patch.slug !== cur.slug) {
        redirects.set(cur.slug, id);
        redirects.delete(patch.slug);
      }
      if (patch.status === 'published' && cur.publishedAt === null) cur.publishedAt = now;
      Object.assign(cur, patch, { updatedAt: now });
      return 'ok';
    },
    async cast({ includeHidden }) {
      return cast.filter((c) => includeHidden || c.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((c) => ({ ...c }));
    },
    async addCast(c) {
      const row = { ...c, id: nid(cast.length + 1, 'c000'), sortOrder: cast.length + 1 };
      cast.push(row);
      return { ...row };
    },
    async updateCast(id, patch) {
      const c = cast.find((x) => x.id === id);
      if (!c) return 'not_found';
      Object.assign(c, patch);
      return 'ok';
    },
    async faq({ includeHidden }) {
      return faq.filter((f) => includeHidden || f.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((f) => ({ ...f }));
    },
    async addFaq(f) {
      const row = { ...f, id: nid(faq.length + 1, 'f000'), sortOrder: faq.length + 1 };
      faq.push(row);
      return { ...row };
    },
    async updateFaq(id, patch) {
      const f = faq.find((x) => x.id === id);
      if (!f) return 'not_found';
      Object.assign(f, patch);
      return 'ok';
    },
    async addComment(c, now) {
      const row = { ...c, id: nid(comments.length + 1, 'd000'), createdAt: now };
      comments.push(row);
      return { ...row };
    },
    async comments({ targetType, targetKey, status, limit }) {
      return comments.filter((c) => (!targetType || c.targetType === targetType) && (!targetKey || c.targetKey === targetKey) && (!status || c.status === status)).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map((c) => ({ ...c }));
    },
    async commentCounts(targetType, status) {
      const out: Record<string, number> = {};
      for (const c of comments) if (c.targetType === targetType && c.status === status) out[c.targetKey] = (out[c.targetKey] ?? 0) + 1;
      return out;
    },
    async setCommentStatus(id, status) {
      const c = comments.find((x) => x.id === id);
      if (!c) return 'not_found';
      c.status = status;
      return 'ok';
    },
    async stats() {
      return { players: 0, products: 0, prices: 0, puzzles: 0, provinces: 0, years: null, posts: posts.filter((p) => p.status === 'published').length };
    },
    async demoPuzzle() {
      return null;
    },
  };
}
