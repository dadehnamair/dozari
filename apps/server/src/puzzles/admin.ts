import { and, asc, count, desc, eq, inArray, pricePoints, productEraTags, products, puzzleGroupItems, puzzleGroups, puzzleTiers, puzzles, sql } from '@dozari/db';
import type { Db } from '@dozari/db';
import { DEFAULT_PUZZLE_TIERS, GROUP_COUNT, GROUP_SIZE, MIN_PRICE_POINTS_PER_PRODUCT, explainRule, generatePuzzle, tierProblem, trackRank } from '@dozari/shared';
import type { AgeTrack, Catalog, GeneratedPuzzle, PuzzleTier, Rng, Rule } from '@dozari/shared';

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
  /** The puzzle's difficulty tier (admin-defined), or null while unrated. */
  tierId: string | null;
  /** Which age track's pool the puzzle belongs to (D198). */
  ageTrack: AgeTrack;
  groups: { level: number; titleFa: string | null; items: string[] }[];
}

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

export type CreateResult = { ok: true; id: string } | { ok: false; error: 'shape' | 'duplicate_product' | 'unknown_product' | 'item_track' };

/** Shape rules of a hand-built puzzle: 4 groups with levels 0–3 once each, 4 products each, 16 distinct products overall. */
export function checkShape(groups: readonly NewGroup[]): 'ok' | 'shape' | 'duplicate_product' {
  if (groups.length !== GROUP_COUNT) return 'shape';
  if (new Set(groups.map((g) => g.level)).size !== GROUP_COUNT || groups.some((g) => !Number.isInteger(g.level) || g.level < 0 || g.level >= GROUP_COUNT)) return 'shape';
  if (groups.some((g) => g.productIds.length !== GROUP_SIZE || g.titleFa.trim().length < 2 || g.explanationFa.trim().length < 2)) return 'shape';
  const all = groups.flatMap((g) => g.productIds);
  return new Set(all).size === all.length ? 'ok' : 'duplicate_product';
}

/** I/O boundary of the admin's puzzle builder: hand-made (`curated`) puzzles go live as `approved` at once, the admin being the human check. */
export interface PuzzleAdmin {
  list(limit: number): Promise<PuzzleAdminRow[]>;
  readiness(): Promise<Readiness>;
  /** `ageTrack` (default adult): a kid or teen puzzle may only hold items of its own track or younger (`item_track` otherwise). */
  create(groups: NewGroup[], tierId?: string | null, ageTrack?: AgeTrack, status?: 'approved' | 'draft'): Promise<CreateResult>;
  /** The difficulty tiers, easiest first; a fresh install gets `DEFAULT_PUZZLE_TIERS`. */
  tiers(): Promise<PuzzleTier[]>;
  saveTier(tier: TierInput): Promise<SaveTierResult>;
  /** Removes a tier; the puzzles that had it become unrated. */
  deleteTier(id: string): Promise<'ok' | 'not_found'>;
  /** Puts a puzzle in a tier (null = unrated). */
  setTier(puzzleId: string, tierId: string | null): Promise<'ok' | 'not_found' | 'unknown_tier'>;
  setStatus(id: string, status: 'approved' | 'retired'): Promise<'ok' | 'not_found'>;
  /** Makes up to `count` validated puzzles from the approved catalog and saves them as `draft` (a human writes the titles, then approves). */
  generate(count: number, rng: Rng): Promise<{ requested: number; created: number; catalogSize: number; ids: string[] }>;
  /** How many puzzles wait as drafts and how many are live (approved). */
  counts(): Promise<{ draft: number; approved: number }>;
  /** Replaces the four titles of a puzzle (level → title). */
  setTitles(id: string, titles: { level: number; titleFa: string }[]): Promise<'ok' | 'not_found'>;
}

/** A rule as the columns of `puzzle_groups`. */
export function ruleColumns(rule: Rule) {
  const base = { ruleKind: rule.kind } as Record<string, unknown>;
  if (rule.kind === 'price_band_at_year') Object.assign(base, { ruleYear: rule.year, ruleMinRials: BigInt(rule.min), ruleMaxRials: BigInt(rule.max) });
  else if (rule.kind === 'multiplier_between') Object.assign(base, { ruleYear: rule.yearA, ruleYearB: rule.yearB, ruleMinX: rule.minX, ruleMaxX: rule.maxX });
  else if (rule.kind === 'era_icon') Object.assign(base, { ruleEraTag: rule.eraTag });
  else if (rule.kind === 'same_price_at_year') Object.assign(base, { ruleYear: rule.year, ruleTargetRials: BigInt(rule.target), ruleTolerancePct: rule.tolerancePct });
  return base as { ruleKind: 'price_band_at_year' | 'multiplier_between' | 'era_icon' | 'same_price_at_year' | 'curated' };
}

/** Generates `count` puzzles from `catalog`, skipping repeats of the same 16 products; shared by the DB and memory admins. */
export function makePuzzles(catalog: Catalog, count: number, rng: Rng): GeneratedPuzzle[] {
  const out: GeneratedPuzzle[] = [];
  const seen = new Set<string>();
  for (let tries = 0; tries < count * 3 && out.length < count; tries++) {
    const g = generatePuzzle(catalog, rng);
    // One failed draw (the generator can miss on a random seed) must not end the run: the try limit bounds it.
    if (!g) continue;
    const key = g.groups.flatMap((x) => x.productIds).sort().join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
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
        .select({ groupId: puzzleGroupItems.groupId, name: products.nameFa })
        .from(puzzleGroupItems)
        .innerJoin(products, eq(products.id, puzzleGroupItems.productId))
        .where(inArray(puzzleGroupItems.puzzleId, ids));
      return rows.map((r) => ({
        id: r.id,
        status: r.status,
        source: r.source,
        createdAt: r.createdAt.getTime(),
        tierId: r.tierId,
        ageTrack: r.ageTrack,
        groups: groups
          .filter((g) => g.puzzleId === r.id)
          .sort((a, b) => a.level - b.level)
          .map((g) => ({ level: g.level, titleFa: g.titleFa, items: items.filter((i) => i.groupId === g.id).map((i) => i.name) })),
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
    async generate(count, rng) {
      const rows = await db
        .select({ id: products.id, category: products.category, year: pricePoints.year, month: pricePoints.month, price: pricePoints.priceRials })
        .from(products)
        .innerJoin(pricePoints, and(eq(pricePoints.productId, products.id), eq(pricePoints.status, 'approved')))
        .where(eq(products.isActive, true));
      const tags = await db.select({ productId: productEraTags.productId, tag: productEraTags.tag }).from(productEraTags);
      const byId = new Map<string, { id: string; category: string; eraTags: string[]; prices: { year: number; month: number | null; priceRials: bigint }[] }>();
      for (const r of rows) {
        const p = byId.get(r.id) ?? byId.set(r.id, { id: r.id, category: r.category, eraTags: [], prices: [] }).get(r.id)!;
        p.prices.push({ year: r.year, month: r.month, priceRials: BigInt(r.price) });
      }
      for (const t of tags) byId.get(t.productId)?.eraTags.push(t.tag);
      const catalog = [...byId.values()].filter((p) => new Set(p.prices.map((x) => x.year)).size >= MIN_PRICE_POINTS_PER_PRODUCT);
      const made = makePuzzles(catalog, count, rng);
      const ids: string[] = [];
      for (const g of made) {
        await db.transaction(async (tx) => {
          const [puzzle] = await tx.insert(puzzles).values({ status: 'draft', source: 'generated' }).$returningId();
          if (!puzzle) throw new Error('puzzle insert failed');
          ids.push(puzzle.id);
          for (const grp of g.groups) {
            const text = explainRule(grp.rule);
            const [group] = await tx.insert(puzzleGroups).values({ puzzleId: puzzle.id, level: grp.level, titleFa: text.slice(0, 100), explanationFa: text.slice(0, 300), ...ruleColumns(grp.rule) }).$returningId();
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
  };
}

/** In-memory twin for tests: `known` is the set of existing product ids. */
export function createMemoryPuzzleAdmin(known: Set<string>, catalog: Catalog = []): PuzzleAdmin & { rows: PuzzleAdminRow[] } {
  const rows: PuzzleAdminRow[] = [];
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
      rows.unshift({ id, status, source: 'curated', createdAt: 0, tierId: tierId ?? null, ageTrack, groups: groups.map((g) => ({ level: g.level, titleFa: g.titleFa, items: g.productIds })) });
      return { ok: true, id };
    },
    async generate(count, rng) {
      const made = makePuzzles(catalog, count, rng);
      const ids: string[] = [];
      for (const g of made) {
        const id = `00000000-0000-7000-9000-${String(rows.length + 1).padStart(12, '0')}`;
        ids.push(id);
        rows.unshift({ id, status: 'draft', source: 'generated', createdAt: 0, tierId: null, ageTrack: 'adult', groups: g.groups.map((x) => ({ level: x.level, titleFa: explainRule(x.rule), items: [...x.productIds] })) });
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
  };
}
