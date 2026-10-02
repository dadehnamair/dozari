import { and, count, desc, eq, inArray, pricePoints, products, puzzleGroupItems, puzzleGroups, puzzles, sql } from '@dozari/db';
import type { Db } from '@dozari/db';
import { GROUP_COUNT, GROUP_SIZE, MIN_PRICE_POINTS_PER_PRODUCT } from '@dozari/shared';

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
  groups: { level: number; titleFa: string | null; items: string[] }[];
}

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

export type CreateResult = { ok: true; id: string } | { ok: false; error: 'shape' | 'duplicate_product' | 'unknown_product' };

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
  create(groups: NewGroup[]): Promise<CreateResult>;
  setStatus(id: string, status: 'approved' | 'retired'): Promise<'ok' | 'not_found'>;
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
    async create(groups) {
      const shape = checkShape(groups);
      if (shape !== 'ok') return { ok: false, error: shape };
      const ids = groups.flatMap((g) => g.productIds);
      const have = await db.select({ id: products.id }).from(products).where(inArray(products.id, ids));
      if (have.length !== ids.length) return { ok: false, error: 'unknown_product' };
      return db.transaction(async (tx) => {
        const [puzzle] = await tx.insert(puzzles).values({ status: 'approved', source: 'curated' }).$returningId();
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
    async setStatus(id, status) {
      const [r] = await db.select({ id: puzzles.id }).from(puzzles).where(and(eq(puzzles.id, id)));
      if (!r) return 'not_found';
      await db.update(puzzles).set({ status }).where(eq(puzzles.id, id));
      return 'ok';
    },
  };
}

/** In-memory twin for tests: `known` is the set of existing product ids. */
export function createMemoryPuzzleAdmin(known: Set<string>): PuzzleAdmin & { rows: PuzzleAdminRow[] } {
  const rows: PuzzleAdminRow[] = [];
  return {
    rows,
    async list(limit) {
      return rows.slice(0, limit).map((r) => ({ ...r }));
    },
    async readiness() {
      return { products: known.size, withPrices: 0, approvedPuzzles: rows.filter((r) => r.status === 'approved').length, productsPerPuzzle: GROUP_COUNT * GROUP_SIZE };
    },
    async create(groups) {
      const shape = checkShape(groups);
      if (shape !== 'ok') return { ok: false, error: shape };
      if (groups.some((g) => g.productIds.some((id) => !known.has(id)))) return { ok: false, error: 'unknown_product' };
      const id = `00000000-0000-7000-9000-${String(rows.length + 1).padStart(12, "0")}`;
      rows.unshift({ id, status: 'approved', source: 'curated', createdAt: 0, groups: groups.map((g) => ({ level: g.level, titleFa: g.titleFa, items: g.productIds })) });
      return { ok: true, id };
    },
    async setStatus(id, status) {
      const r = rows.find((x) => x.id === id);
      if (!r) return 'not_found';
      r.status = status;
      return 'ok';
    },
  };
}
