import { isItemIconKey } from '@dozari/shared';
import { and, asc, count, desc, eq, inArray, pricePoints, productEraTags, products, puzzleGroupItems, puzzleGroups, puzzleTagDefs, puzzleTags, puzzleTiers, puzzleTopics, puzzles, sql } from '@dozari/db';
import { ruleToColumns } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';
import { DEFAULT_PUZZLE_TIERS, PUZZLE_TAGS_MAX, GROUP_COUNT, GROUP_SIZE, MIN_PRICE_POINTS_PER_PRODUCT, draftTitle, explainRule, generatePuzzle, representativeLevel, tierProblem, trackRank } from '@dozari/shared';
import type { AgeTrack, Catalog, GeneratedPuzzle, PuzzleTier, Rng } from '@dozari/shared';

export interface NewGroup {
  level: number;
  titleFa: string;
  explanationFa: string;
  productIds: string[];
}

export interface PuzzleAdminRow {
  id: string;
  status: 'draft' | 'approved' | 'retired';
  source: 'generated' | 'curated' | 'ugc';
  createdAt: number;
  /** When an admin last re-checked it (بازبینی), or null = never reviewed. Does not affect serving. */
  reviewedAt: number | null;
  /** The puzzle's difficulty tier (admin-defined), or null while unrated. */
  tierId: string | null;
  /** Which age track's pool the puzzle belongs to (D198). */
  ageTrack: AgeTrack;
  /** Topic (موضوع) it is filed under for themed rounds, and its free-text tags. */
  topicId: string | null;
  tags: string[];
  groups: { level: number; titleFa: string | null; items: string[]; /** Product ids, parallel to `items`. */ productIds: string[] }[];
}

export interface TopicRow {
  id: string;
  slug: string;
  nameFa: string;
  /** Icon of the pack (`ITEMS` key) the app shows for the topic; null = none chosen. */
  iconKey: string | null;
  /** Emoji for bot messages. */
  emoji: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Approved puzzles filed under it (a topic is offered in a match only with enough of them). */
  puzzles: number;
}
export type TopicInput = { id?: string; slug: string; nameFa: string; iconKey?: string | null; emoji?: string | null; sortOrder: number; isActive: boolean };
export type SaveTopicResult = { ok: true; id: string } | { ok: false; error: 'slug' | 'name' | 'icon' | 'emoji' | 'duplicate' | 'not_found' };

/** A defined tag (the vocabulary puzzles may be tagged from) with how many puzzles carry it. */
export interface TagRow {
  id: string;
  slug: string;
  nameFa: string;
  sortOrder: number;
  isActive: boolean;
  puzzles: number;
}
export type TagInput = { id?: string; slug: string; nameFa: string; sortOrder: number; isActive: boolean };
export type SaveTagResult = { ok: true; id: string } | { ok: false; error: 'slug' | 'name' | 'duplicate' | 'not_found' };

/** Tags are the slugs of defined tags; blanks and repeats go, the count is capped. */
export function cleanTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 1 && t.length <= 50))].slice(0, PUZZLE_TAGS_MAX);
}

/** A topic emoji: a few pictographs and nothing else (empty = none); null when the text is not an emoji. */
export function cleanEmoji(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  if (t === '') return null;
  return t.length <= 16 && /^(?:\p{Extended_Pictographic}|\u200d|\ufe0f|\p{Emoji_Modifier}|\p{Regional_Indicator})+$/u.test(t) ? t : null;
}

/** Slug rule shared by topics and tags. */
export const validSlug = (slug: string): boolean => /^[a-z0-9][a-z0-9-]{0,48}$/.test(slug);

export type TierInput = { id?: string; nameFa: string; sortOrder: number; minLevel: number; maxLevel: number | null };
export type SaveTierResult = { ok: true; id: string } | { ok: false; error: 'name' | 'level_range' | 'not_found' };

/** What stands between the catalog and playable puzzles. */
export interface Readiness {
  /** Products in the catalog. */
  products: number;
  /** Products with at least `MIN_PRICE_POINTS_PER_PRODUCT` approved prices (what the generator and the price round need). */
  withPrices: number;
  approvedPuzzles: number;
  /** A puzzle is `GROUP_COUNT` groups of `GROUP_SIZE` distinct products. */
  productsPerPuzzle: number;
}

export type SwapResult = { ok: true; status: PuzzleAdminRow['status'] } | { ok: false; error: 'not_found' | 'not_in_puzzle' | 'same_product' | 'unknown_product' | 'duplicate_product' | 'item_track' };

export type CreateResult = { ok: true; id: string } | { ok: false; error: 'shape' | 'duplicate_product' | 'unknown_product' | 'item_track' };

/** Shape rules of a hand-built puzzle: 4 groups with levels 0–3 once each, 4 products each, 16 distinct products overall. */
export function checkShape(groups: readonly NewGroup[]): 'ok' | 'shape' | 'duplicate_product' {
  if (groups.length !== GROUP_COUNT) return 'shape';
  if (new Set(groups.map((g) => g.level)).size !== GROUP_COUNT || groups.some((g) => !Number.isInteger(g.level) || g.level < 0 || g.level >= GROUP_COUNT)) return 'shape';
  if (groups.some((g) => g.productIds.length !== GROUP_SIZE || g.titleFa.trim().length < 2 || g.explanationFa.trim().length < 2)) return 'shape';
  const all = groups.flatMap((g) => g.productIds);
  return new Set(all).size === all.length ? 'ok' : 'duplicate_product';
}

/** I/O boundary of the admin's puzzle builder: hand-made (`curated`) puzzles go live as `approved` at once, the admin being the human check. Machine-made ones (generator, AI) are only ever `draft` until a human approves. */
export interface PuzzleAdmin {
  list(limit: number): Promise<PuzzleAdminRow[]>;
  readiness(): Promise<Readiness>;
  /** `ageTrack` (default adult): a kid or teen puzzle may only hold items of its own track or younger (`item_track` otherwise). */
  create(groups: NewGroup[], tierId?: string | null, ageTrack?: AgeTrack, status?: 'approved' | 'draft'): Promise<CreateResult>;
  /** Replaces one product of a puzzle by another (same group, same slot); the puzzle keeps its status (the admin editing it is the human check). */
  swapProduct(puzzleId: string, fromProductId: string, toProductId: string): Promise<SwapResult>;
  /** The difficulty tiers, easiest first; a fresh install gets `DEFAULT_PUZZLE_TIERS`. */
  tiers(): Promise<PuzzleTier[]>;
  saveTier(tier: TierInput): Promise<SaveTierResult>;
  /** Removes a tier; the puzzles that had it become unrated. */
  deleteTier(id: string): Promise<'ok' | 'not_found'>;
  /** Puts a puzzle in a tier (null = unrated). */
  setTier(puzzleId: string, tierId: string | null): Promise<'ok' | 'not_found' | 'unknown_tier'>;
  setStatus(id: string, status: 'approved' | 'retired' | 'draft'): Promise<'ok' | 'not_found'>;
  /** Stamps the puzzle as reviewed now (re-review overwrites the time), or clears the mark (`reviewed: false`). The puzzle's status and serving are untouched. */
  markReviewed(id: string, reviewed: boolean, now?: Date): Promise<'ok' | 'not_found'>;
  /** The topics (admin order) with how many approved puzzles each holds. */
  topics(): Promise<TopicRow[]>;
  saveTopic(topic: TopicInput): Promise<SaveTopicResult>;
  /** Files a puzzle under a topic (null = general) and replaces its tags. */
  setTopic(puzzleId: string, topicId: string | null, tags: readonly string[]): Promise<'ok' | 'not_found' | 'unknown_topic' | 'unknown_tag'>;
  /** The tag vocabulary (admin order) with how many puzzles carry each; puzzles can only be tagged from it. */
  tags(): Promise<TagRow[]>;
  saveTag(tag: TagInput): Promise<SaveTagResult>;
  /**
   * Makes up to `count` validated puzzles from the approved catalog and saves them as `draft` (a human polishes the titles, then approves).
   * Each puzzle is made for the player levels of a tier (`opts.tierId`, or every tier in turn) and tagged with it.
   */
  generate(count: number, rng: Rng, opts?: GenerateOpts): Promise<{ requested: number; created: number; catalogSize: number; ids: string[] }>;
  /** How many puzzles wait as drafts and how many are live (approved). */
  counts(): Promise<{ draft: number; approved: number }>;
  /** Replaces the four titles of a puzzle (level → title). */
  setTitles(id: string, titles: { level: number; titleFa: string }[]): Promise<'ok' | 'not_found'>;
}

export interface GenerateOpts {
  /** Make every puzzle for this tier's player levels; omitted = go through all tiers in turn. */
  tierId?: string;
  /** Title = the plain rule (for auto-approve, where no human polishes the title) instead of a varied draft title. */
  plainTitles?: boolean;
  /** File every made puzzle under this topic (گروه) and tag it; the caller has checked both exist. */
  topicId?: string | null;
  tags?: readonly string[];
}

export interface MadePuzzle {
  puzzle: GeneratedPuzzle;
  tierId: string | null;
}

/**
 * Generates `count` puzzles from `catalog`, skipping repeats of the same 16 products; shared by the DB and memory admins.
 * Puzzle k is made for the player levels of tier k (round robin over `tiers`, or only `tierId`), so the pool covers every level range.
 */
export function makePuzzles(catalog: Catalog, count: number, rng: Rng, tiers: readonly PuzzleTier[] = [], tierId?: string): MadePuzzle[] {
  const ladder = tierId ? tiers.filter((t) => t.id === tierId) : [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);
  const out: MadePuzzle[] = [];
  const seen = new Set<string>();
  for (let tries = 0; tries < count * 3 && out.length < count; tries++) {
    const tier = ladder.length > 0 ? (ladder[out.length % ladder.length] as PuzzleTier) : null;
    const g = generatePuzzle(catalog, rng, tier ? { playerLevel: representativeLevel(tier.minLevel, tier.maxLevel) } : {});
    // One failed draw (the generator can miss on a random seed) must not end the run: the try limit bounds it.
    if (!g) continue;
    const key = g.groups.flatMap((x) => x.productIds).sort().join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ puzzle: g, tierId: tier?.id ?? null });
  }
  return out;
}

export function createDbPuzzleAdmin(db: Db): PuzzleAdmin {
  return {
    async list(limit) {
      const rows = await db.select().from(puzzles).orderBy(desc(puzzles.createdAt)).limit(limit);
      if (rows.length === 0) return [];
      const ids = rows.map((r) => r.id);
      const groups = await db.select().from(puzzleGroups).where(inArray(puzzleGroups.puzzleId, ids));
      const items = await db
        .select({ groupId: puzzleGroupItems.groupId, productId: puzzleGroupItems.productId, name: products.nameFa })
        .from(puzzleGroupItems)
        .innerJoin(products, eq(products.id, puzzleGroupItems.productId))
        .where(inArray(puzzleGroupItems.puzzleId, ids));
      const tagRows = await db.select().from(puzzleTags).where(inArray(puzzleTags.puzzleId, ids));
      return rows.map((r) => ({
        id: r.id,
        status: r.status,
        source: r.source,
        createdAt: r.createdAt.getTime(),
        reviewedAt: r.reviewedAt?.getTime() ?? null,
        tierId: r.tierId,
        ageTrack: r.ageTrack,
        topicId: r.topicId,
        tags: tagRows.filter((t) => t.puzzleId === r.id).map((t) => t.tag),
        groups: groups
          .filter((g) => g.puzzleId === r.id)
          .sort((a, b) => a.level - b.level)
          .map((g) => ({ level: g.level, titleFa: g.titleFa, items: items.filter((i) => i.groupId === g.id).map((i) => i.name), productIds: items.filter((i) => i.groupId === g.id).map((i) => i.productId) })),
      }));
    },
    async readiness() {
      const [p] = await db.select({ n: count() }).from(products);
      const [w] = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(products)
        .where(sql`(SELECT COUNT(*) FROM ${pricePoints} WHERE ${pricePoints.productId} = ${products.id} AND ${pricePoints.status} = 'approved') >= ${MIN_PRICE_POINTS_PER_PRODUCT}`);
      const [a] = await db.select({ n: count() }).from(puzzles).where(eq(puzzles.status, 'approved'));
      return { products: Number(p?.n ?? 0), withPrices: Number(w?.n ?? 0), approvedPuzzles: Number(a?.n ?? 0), productsPerPuzzle: GROUP_COUNT * GROUP_SIZE };
    },
    async create(groups, tierId, ageTrack = 'adult', status = 'approved') {
      const shape = checkShape(groups);
      if (shape !== 'ok') return { ok: false, error: shape };
      const ids = groups.flatMap((g) => g.productIds);
      const have = await db.select({ id: products.id, ageTrack: products.ageTrack }).from(products).where(inArray(products.id, ids));
      if (have.length !== ids.length) return { ok: false, error: 'unknown_product' };
      if (have.some((p) => trackRank(p.ageTrack) > trackRank(ageTrack))) return { ok: false, error: 'item_track' };
      return db.transaction(async (tx) => {
        const [puzzle] = await tx.insert(puzzles).values({ status, source: 'curated', tierId: tierId ?? null, ageTrack }).$returningId();
        if (!puzzle) throw new Error('puzzle insert failed');
        for (const g of groups) {
          const [group] = await tx
            .insert(puzzleGroups)
            .values({ puzzleId: puzzle.id, level: g.level, titleFa: g.titleFa.trim(), explanationFa: g.explanationFa.trim(), ruleKind: 'curated', ruleNote: 'admin' })
            .$returningId();
          if (!group) throw new Error('group insert failed');
          await tx.insert(puzzleGroupItems).values(g.productIds.map((productId) => ({ groupId: group.id, puzzleId: puzzle.id, productId })));
        }
        return { ok: true as const, id: puzzle.id };
      });
    },
    async swapProduct(puzzleId, fromProductId, toProductId) {
      if (fromProductId === toProductId) return { ok: false, error: 'same_product' };
      const [puzzle] = await db.select({ id: puzzles.id, status: puzzles.status, ageTrack: puzzles.ageTrack }).from(puzzles).where(eq(puzzles.id, puzzleId));
      if (!puzzle) return { ok: false, error: 'not_found' };
      const inPuzzle = await db.select({ productId: puzzleGroupItems.productId }).from(puzzleGroupItems).where(eq(puzzleGroupItems.puzzleId, puzzleId));
      if (!inPuzzle.some((i) => i.productId === fromProductId)) return { ok: false, error: 'not_in_puzzle' };
      if (inPuzzle.some((i) => i.productId === toProductId)) return { ok: false, error: 'duplicate_product' };
      const [next] = await db.select({ ageTrack: products.ageTrack }).from(products).where(eq(products.id, toProductId));
      if (!next) return { ok: false, error: 'unknown_product' };
      if (trackRank(next.ageTrack) > trackRank(puzzle.ageTrack)) return { ok: false, error: 'item_track' };
      // The year hint belonged to the old product, so it goes with it.
      await db.update(puzzleGroupItems).set({ productId: toProductId, displayYear: null }).where(and(eq(puzzleGroupItems.puzzleId, puzzleId), eq(puzzleGroupItems.productId, fromProductId)));
      return { ok: true, status: puzzle.status };
    },
    async generate(count, rng, opts = {}) {
      const rows = await db
        .select({ id: products.id, name: products.nameFa, category: products.category, year: pricePoints.year, month: pricePoints.month, price: pricePoints.priceRials })
        .from(products)
        .innerJoin(pricePoints, and(eq(pricePoints.productId, products.id), eq(pricePoints.status, 'approved')))
        .where(eq(products.isActive, true));
      const tags = await db.select({ productId: productEraTags.productId, tag: productEraTags.tag }).from(productEraTags);
      const names = new Map(rows.map((r) => [r.id, r.name] as const));
      const byId = new Map<string, { id: string; category: string; eraTags: string[]; prices: { year: number; month: number | null; priceRials: bigint }[] }>();
      for (const r of rows) {
        const p = byId.get(r.id) ?? byId.set(r.id, { id: r.id, category: r.category, eraTags: [], prices: [] }).get(r.id)!;
        p.prices.push({ year: r.year, month: r.month, priceRials: BigInt(r.price) });
      }
      for (const t of tags) byId.get(t.productId)?.eraTags.push(t.tag);
      const catalog = [...byId.values()].filter((p) => new Set(p.prices.map((x) => x.year)).size >= MIN_PRICE_POINTS_PER_PRODUCT);
      const made = makePuzzles(catalog, count, rng, await this.tiers(), opts.tierId);
      const ids: string[] = [];
      for (const { puzzle: g, tierId } of made) {
        await db.transaction(async (tx) => {
          const [puzzle] = await tx.insert(puzzles).values({ status: 'draft', source: 'generated', tierId, topicId: opts.topicId ?? null }).$returningId();
          if (!puzzle) throw new Error('puzzle insert failed');
          ids.push(puzzle.id);
          const wanted = cleanTags(opts.tags ?? []);
          if (wanted.length > 0) await tx.insert(puzzleTags).values(wanted.map((tag) => ({ puzzleId: puzzle.id, tag })));
          for (const grp of g.groups) {
            const text = explainRule(grp.rule, names);
            const title = opts.plainTitles ? text : draftTitle(grp.rule, rng, names);
            const [group] = await tx.insert(puzzleGroups).values({ puzzleId: puzzle.id, level: grp.level, titleFa: title.slice(0, 100), explanationFa: text.slice(0, 300), ...ruleToColumns(grp.rule) }).$returningId();
            if (!group) throw new Error('group insert failed');
            await tx.insert(puzzleGroupItems).values(grp.productIds.map((productId) => ({ groupId: group.id, puzzleId: puzzle.id, productId })));
          }
        });
      }
      return { requested: count, created: made.length, catalogSize: catalog.length, ids };
    },
    async tiers() {
      let rows = await db.select().from(puzzleTiers).orderBy(asc(puzzleTiers.sortOrder));
      if (rows.length === 0) {
        await db.insert(puzzleTiers).values(DEFAULT_PUZZLE_TIERS.map((t) => ({ ...t })));
        rows = await db.select().from(puzzleTiers).orderBy(asc(puzzleTiers.sortOrder));
      }
      return rows.map((r) => ({ id: r.id, nameFa: r.nameFa, sortOrder: r.sortOrder, minLevel: r.minLevel, maxLevel: r.maxLevel }));
    },
    async saveTier(t) {
      const problem = tierProblem(t);
      if (problem) return { ok: false, error: problem };
      const values = { nameFa: t.nameFa.trim(), sortOrder: t.sortOrder, minLevel: t.minLevel, maxLevel: t.maxLevel };
      if (!t.id) {
        const [row] = await db.insert(puzzleTiers).values(values).$returningId();
        if (!row) throw new Error('tier insert failed');
        return { ok: true, id: row.id };
      }
      const [have] = await db.select({ id: puzzleTiers.id }).from(puzzleTiers).where(eq(puzzleTiers.id, t.id));
      if (!have) return { ok: false, error: 'not_found' };
      await db.update(puzzleTiers).set(values).where(eq(puzzleTiers.id, t.id));
      return { ok: true, id: t.id };
    },
    async deleteTier(id) {
      const [have] = await db.select({ id: puzzleTiers.id }).from(puzzleTiers).where(eq(puzzleTiers.id, id));
      if (!have) return 'not_found';
      await db.transaction(async (tx) => {
        await tx.update(puzzles).set({ tierId: null }).where(eq(puzzles.tierId, id));
        await tx.delete(puzzleTiers).where(eq(puzzleTiers.id, id));
      });
      return 'ok';
    },
    async setTier(puzzleId, tierId) {
      const [r] = await db.select({ id: puzzles.id }).from(puzzles).where(eq(puzzles.id, puzzleId));
      if (!r) return 'not_found';
      if (tierId) {
        const [t] = await db.select({ id: puzzleTiers.id }).from(puzzleTiers).where(eq(puzzleTiers.id, tierId));
        if (!t) return 'unknown_tier';
      }
      await db.update(puzzles).set({ tierId }).where(eq(puzzles.id, puzzleId));
      return 'ok';
    },
    async topics() {
      const rows = await db.select().from(puzzleTopics).orderBy(asc(puzzleTopics.sortOrder), asc(puzzleTopics.nameFa));
      const counts = await db.select({ topicId: puzzles.topicId, n: count() }).from(puzzles).where(eq(puzzles.status, 'approved')).groupBy(puzzles.topicId);
      return rows.map((r) => ({ id: r.id, slug: r.slug, nameFa: r.nameFa, iconKey: r.iconKey, emoji: r.emoji, sortOrder: r.sortOrder, isActive: r.isActive, puzzles: Number(counts.find((c) => c.topicId === r.id)?.n ?? 0) }));
    },
    async saveTopic(t) {
      const slug = t.slug.trim().toLowerCase();
      const nameFa = t.nameFa.trim();
      if (!validSlug(slug)) return { ok: false, error: 'slug' };
      if (nameFa.length < 2 || nameFa.length > 60) return { ok: false, error: 'name' };
      const iconKey = t.iconKey === undefined ? undefined : t.iconKey && isItemIconKey(t.iconKey) ? t.iconKey : null;
      if (t.iconKey && iconKey === null) return { ok: false, error: 'icon' };
      const emoji = t.emoji === undefined ? undefined : cleanEmoji(t.emoji);
      if (t.emoji && emoji === null) return { ok: false, error: 'emoji' };
      const [clash] = await db.select({ id: puzzleTopics.id }).from(puzzleTopics).where(eq(puzzleTopics.slug, slug));
      if (clash && clash.id !== t.id) return { ok: false, error: 'duplicate' };
      if (t.id) {
        const [r] = await db.select({ id: puzzleTopics.id }).from(puzzleTopics).where(eq(puzzleTopics.id, t.id));
        if (!r) return { ok: false, error: 'not_found' };
        await db.update(puzzleTopics).set({ slug, nameFa, iconKey, emoji, sortOrder: t.sortOrder, isActive: t.isActive }).where(eq(puzzleTopics.id, t.id));
        return { ok: true, id: t.id };
      }
      const id = uuidv7();
      await db.insert(puzzleTopics).values({ id, slug, nameFa, iconKey: iconKey ?? null, emoji: emoji ?? null, sortOrder: t.sortOrder, isActive: t.isActive });
      return { ok: true, id };
    },
    async setTopic(puzzleId, topicId, tags) {
      const [r] = await db.select({ id: puzzles.id }).from(puzzles).where(eq(puzzles.id, puzzleId));
      if (!r) return 'not_found';
      if (topicId) {
        const [t] = await db.select({ id: puzzleTopics.id }).from(puzzleTopics).where(eq(puzzleTopics.id, topicId));
        if (!t) return 'unknown_topic';
      }
      const clean = cleanTags(tags);
      if (clean.length > 0) {
        // Only defined tags: a switched-off one stays on a puzzle that already has it but cannot be added.
        const defs = await db.select({ slug: puzzleTagDefs.slug, isActive: puzzleTagDefs.isActive }).from(puzzleTagDefs).where(inArray(puzzleTagDefs.slug, clean));
        const had = new Set((await db.select({ tag: puzzleTags.tag }).from(puzzleTags).where(eq(puzzleTags.puzzleId, puzzleId))).map((x) => x.tag));
        const ok = new Set(defs.filter((d) => d.isActive || had.has(d.slug)).map((d) => d.slug));
        if (clean.some((t) => !ok.has(t))) return 'unknown_tag';
      }
      await db.transaction(async (tx) => {
        await tx.update(puzzles).set({ topicId }).where(eq(puzzles.id, puzzleId));
        await tx.delete(puzzleTags).where(eq(puzzleTags.puzzleId, puzzleId));
        if (clean.length > 0) await tx.insert(puzzleTags).values(clean.map((tag) => ({ puzzleId, tag })));
      });
      return 'ok';
    },
    async tags() {
      const rows = await db.select().from(puzzleTagDefs).orderBy(asc(puzzleTagDefs.sortOrder), asc(puzzleTagDefs.nameFa));
      const used = await db.select({ tag: puzzleTags.tag, n: count() }).from(puzzleTags).groupBy(puzzleTags.tag);
      return rows.map((r) => ({ id: r.id, slug: r.slug, nameFa: r.nameFa, sortOrder: r.sortOrder, isActive: r.isActive, puzzles: Number(used.find((u) => u.tag === r.slug)?.n ?? 0) }));
    },
    async saveTag(t) {
      const slug = t.slug.trim().toLowerCase();
      const nameFa = t.nameFa.trim();
      if (!validSlug(slug)) return { ok: false, error: 'slug' };
      if (nameFa.length < 2 || nameFa.length > 60) return { ok: false, error: 'name' };
      const [clash] = await db.select({ id: puzzleTagDefs.id }).from(puzzleTagDefs).where(eq(puzzleTagDefs.slug, slug));
      if (clash && clash.id !== t.id) return { ok: false, error: 'duplicate' };
      if (t.id) {
        const [r] = await db.select({ id: puzzleTagDefs.id, slug: puzzleTagDefs.slug }).from(puzzleTagDefs).where(eq(puzzleTagDefs.id, t.id));
        if (!r) return { ok: false, error: 'not_found' };
        await db.transaction(async (tx) => {
          await tx.update(puzzleTagDefs).set({ slug, nameFa, sortOrder: t.sortOrder, isActive: t.isActive }).where(eq(puzzleTagDefs.id, t.id!));
          // Puzzles carry the slug: renaming it moves them along.
          if (r.slug !== slug) await tx.update(puzzleTags).set({ tag: slug }).where(eq(puzzleTags.tag, r.slug));
        });
        return { ok: true, id: t.id };
      }
      const id = uuidv7();
      await db.insert(puzzleTagDefs).values({ id, slug, nameFa, sortOrder: t.sortOrder, isActive: t.isActive });
      return { ok: true, id };
    },
    async counts() {
      const rows = await db.select({ status: puzzles.status, n: count() }).from(puzzles).groupBy(puzzles.status);
      const n = (s: string) => Number(rows.find((r) => r.status === s)?.n ?? 0);
      return { draft: n('draft'), approved: n('approved') };
    },
    async setTitles(id, titles) {
      const [r] = await db.select({ id: puzzles.id }).from(puzzles).where(eq(puzzles.id, id));
      if (!r) return 'not_found';
      for (const t of titles) await db.update(puzzleGroups).set({ titleFa: t.titleFa.trim() }).where(and(eq(puzzleGroups.puzzleId, id), eq(puzzleGroups.level, t.level)));
      return 'ok';
    },
    async setStatus(id, status) {
      const [r] = await db.select({ id: puzzles.id }).from(puzzles).where(and(eq(puzzles.id, id)));
      if (!r) return 'not_found';
      await db.update(puzzles).set({ status }).where(eq(puzzles.id, id));
      return 'ok';
    },
    async markReviewed(id, reviewed, now = new Date()) {
      const [r] = await db.select({ id: puzzles.id }).from(puzzles).where(eq(puzzles.id, id));
      if (!r) return 'not_found';
      await db.update(puzzles).set({ reviewedAt: reviewed ? now : null }).where(eq(puzzles.id, id));
      return 'ok';
    },
  };
}

/** In-memory twin for tests: `known` is the set of existing product ids. */
export function createMemoryPuzzleAdmin(known: Set<string>, catalog: Catalog = []): PuzzleAdmin & { rows: PuzzleAdminRow[] } {
  const rows: PuzzleAdminRow[] = [];
  const topicRows: TopicRow[] = [];
  const tagRows: TagRow[] = [];
  let tiers: PuzzleTier[] = [];
  return {
    rows,
    async list(limit) {
      return rows.slice(0, limit).map((r) => ({ ...r }));
    },
    async readiness() {
      return { products: known.size, withPrices: 0, approvedPuzzles: rows.filter((r) => r.status === 'approved').length, productsPerPuzzle: GROUP_COUNT * GROUP_SIZE };
    },
    async create(groups, tierId, ageTrack = 'adult', status = 'approved') {
      const shape = checkShape(groups);
      if (shape !== 'ok') return { ok: false, error: shape };
      if (groups.some((g) => g.productIds.some((id) => !known.has(id)))) return { ok: false, error: 'unknown_product' };
      const id = `00000000-0000-7000-9000-${String(rows.length + 1).padStart(12, "0")}`;
      rows.unshift({ id, status, source: 'curated', createdAt: 0, reviewedAt: null, tierId: tierId ?? null, ageTrack, topicId: null, tags: [], groups: groups.map((g) => ({ level: g.level, titleFa: g.titleFa, items: g.productIds, productIds: g.productIds })) });
      return { ok: true, id };
    },
    async swapProduct(puzzleId, fromProductId, toProductId) {
      const r = rows.find((x) => x.id === puzzleId);
      if (!r) return { ok: false, error: 'not_found' };
      if (fromProductId === toProductId) return { ok: false, error: 'same_product' };
      const all = r.groups.flatMap((g) => g.productIds);
      if (!all.includes(fromProductId)) return { ok: false, error: 'not_in_puzzle' };
      if (all.includes(toProductId)) return { ok: false, error: 'duplicate_product' };
      if (!known.has(toProductId)) return { ok: false, error: 'unknown_product' };
      for (const g of r.groups) {
        g.productIds = g.productIds.map((id) => (id === fromProductId ? toProductId : id));
        g.items = g.items.map((id) => (id === fromProductId ? toProductId : id));
      }
      return { ok: true, status: r.status };
    },
    async generate(count, rng, opts = {}) {
      const made = makePuzzles(catalog, count, rng, await this.tiers(), opts.tierId);
      const ids: string[] = [];
      for (const { puzzle: g, tierId } of made) {
        const id = `00000000-0000-7000-9000-${String(rows.length + 1).padStart(12, '0')}`;
        ids.push(id);
        rows.unshift({ id, status: 'draft', source: 'generated', createdAt: 0, reviewedAt: null, tierId, ageTrack: 'adult', topicId: opts.topicId ?? null, tags: cleanTags(opts.tags ?? []), groups: g.groups.map((x) => ({ level: x.level, titleFa: opts.plainTitles ? explainRule(x.rule) : draftTitle(x.rule, rng), items: [...x.productIds], productIds: [...x.productIds] })) });
      }
      return { requested: count, created: made.length, catalogSize: catalog.length, ids };
    },
    async tiers() {
      if (tiers.length === 0) tiers = DEFAULT_PUZZLE_TIERS.map((t, i) => ({ ...t, id: `00000000-0000-7000-a000-${String(i + 1).padStart(12, '0')}` }));
      return [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);
    },
    async saveTier(t) {
      const problem = tierProblem(t);
      if (problem) return { ok: false, error: problem };
      if (!t.id) {
        const id = `00000000-0000-7000-a000-${String(tiers.length + 101).padStart(12, '0')}`;
        tiers.push({ id, nameFa: t.nameFa.trim(), sortOrder: t.sortOrder, minLevel: t.minLevel, maxLevel: t.maxLevel });
        return { ok: true, id };
      }
      const cur = tiers.find((x) => x.id === t.id);
      if (!cur) return { ok: false, error: 'not_found' };
      Object.assign(cur, { nameFa: t.nameFa.trim(), sortOrder: t.sortOrder, minLevel: t.minLevel, maxLevel: t.maxLevel });
      return { ok: true, id: cur.id };
    },
    async deleteTier(id) {
      if (!tiers.some((x) => x.id === id)) return 'not_found';
      tiers = tiers.filter((x) => x.id !== id);
      for (const r of rows) if (r.tierId === id) r.tierId = null;
      return 'ok';
    },
    async setTier(puzzleId, tierId) {
      const r = rows.find((x) => x.id === puzzleId);
      if (!r) return 'not_found';
      if (tierId && !tiers.some((x) => x.id === tierId)) return 'unknown_tier';
      r.tierId = tierId;
      return 'ok';
    },
    async topics() {
      return topicRows.map((t) => ({ ...t, puzzles: rows.filter((r) => r.status === 'approved' && r.topicId === t.id).length }));
    },
    async saveTopic(t) {
      const slug = t.slug.trim().toLowerCase();
      const nameFa = t.nameFa.trim();
      if (!validSlug(slug)) return { ok: false, error: 'slug' };
      if (nameFa.length < 2 || nameFa.length > 60) return { ok: false, error: 'name' };
      if (topicRows.some((x) => x.slug === slug && x.id !== t.id)) return { ok: false, error: 'duplicate' };
      if (t.iconKey && !isItemIconKey(t.iconKey)) return { ok: false, error: 'icon' };
      if (t.emoji && cleanEmoji(t.emoji) === null) return { ok: false, error: 'emoji' };
      if (t.id) {
        const x = topicRows.find((r) => r.id === t.id);
        if (!x) return { ok: false, error: 'not_found' };
        Object.assign(x, { slug, nameFa, ...(t.iconKey === undefined ? {} : { iconKey: t.iconKey || null }), ...(t.emoji === undefined ? {} : { emoji: cleanEmoji(t.emoji) }), sortOrder: t.sortOrder, isActive: t.isActive });
        return { ok: true, id: x.id };
      }
      const id = `00000000-0000-7000-d000-${String(topicRows.length + 1).padStart(12, '0')}`;
      topicRows.push({ id, slug, nameFa, iconKey: t.iconKey || null, emoji: cleanEmoji(t.emoji), sortOrder: t.sortOrder, isActive: t.isActive, puzzles: 0 });
      return { ok: true, id };
    },
    async setTopic(puzzleId, topicId, tags) {
      const r = rows.find((x) => x.id === puzzleId);
      if (!r) return 'not_found';
      if (topicId && !topicRows.some((t) => t.id === topicId)) return 'unknown_topic';
      const clean = cleanTags(tags);
      if (clean.some((t) => !tagRows.some((d) => d.slug === t && (d.isActive || r.tags.includes(t))))) return 'unknown_tag';
      r.topicId = topicId;
      r.tags = clean;
      return 'ok';
    },
    async tags() {
      return tagRows.map((t) => ({ ...t, puzzles: rows.filter((r) => r.tags.includes(t.slug)).length }));
    },
    async saveTag(t) {
      const slug = t.slug.trim().toLowerCase();
      const nameFa = t.nameFa.trim();
      if (!validSlug(slug)) return { ok: false, error: 'slug' };
      if (nameFa.length < 2 || nameFa.length > 60) return { ok: false, error: 'name' };
      if (tagRows.some((x) => x.slug === slug && x.id !== t.id)) return { ok: false, error: 'duplicate' };
      if (t.id) {
        const x = tagRows.find((r) => r.id === t.id);
        if (!x) return { ok: false, error: 'not_found' };
        for (const r of rows) r.tags = r.tags.map((g) => (g === x.slug ? slug : g));
        Object.assign(x, { slug, nameFa, sortOrder: t.sortOrder, isActive: t.isActive });
        return { ok: true, id: x.id };
      }
      const id = `00000000-0000-7000-e000-${String(tagRows.length + 1).padStart(12, '0')}`;
      tagRows.push({ id, slug, nameFa, sortOrder: t.sortOrder, isActive: t.isActive, puzzles: 0 });
      return { ok: true, id };
    },
    async counts() {
      return { draft: rows.filter((r) => r.status === 'draft').length, approved: rows.filter((r) => r.status === 'approved').length };
    },
    async setTitles(id, titles) {
      const r = rows.find((x) => x.id === id);
      if (!r) return 'not_found';
      for (const t of titles) {
        const g = r.groups.find((x) => x.level === t.level);
        if (g) g.titleFa = t.titleFa;
      }
      return 'ok';
    },
    async setStatus(id, status) {
      const r = rows.find((x) => x.id === id);
      if (!r) return 'not_found';
      r.status = status;
      return 'ok';
    },
    async markReviewed(id, reviewed, now = new Date()) {
      const r = rows.find((x) => x.id === id);
      if (!r) return 'not_found';
      r.reviewedAt = reviewed ? now.getTime() : null;
      return 'ok';
    },
  };
}
