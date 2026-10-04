import { and, asc, eq, inArray, pricePoints, products, puzzleGroupItems, puzzleGroups, puzzles, sql } from '@dozari/db';
import type { Db } from '@dozari/db';
import { GROUP_COUNT, GROUP_SIZE } from '@dozari/shared';
import type { GroupLevel } from '@dozari/shared';
import type { PricePointRow, PuzzleSource, ServedPuzzle } from './types.js';

/** How many random approved puzzles one pick tries before giving up. */
const PICK_ATTEMPTS = 5;

/** Serves a random `approved` puzzle with its groups and card texts. */
export function createDbPuzzleSource(db: Db): PuzzleSource {
  return {
    async pricesFor(productIds) {
      if (productIds.length === 0) return {};
      const rows = await db
        .select({ productId: pricePoints.productId, year: pricePoints.year, month: pricePoints.month, priceRials: pricePoints.priceRials })
        .from(pricePoints)
        .where(and(inArray(pricePoints.productId, [...productIds]), eq(pricePoints.status, 'approved')))
        .orderBy(asc(pricePoints.year), asc(pricePoints.month));
      const out: Record<string, PricePointRow[]> = {};
      for (const r of rows) (out[r.productId] ??= []).push({ year: r.year, month: r.month, priceRials: r.priceRials });
      return out;
    },
    async pickRandom() {
      // A few random candidates, not one: an approved puzzle with missing groups or items is skipped instead of
      // turning the whole request into "no puzzle" while playable ones exist.
      const candidates = await db
        .select({ id: puzzles.id })
        .from(puzzles)
        .where(eq(puzzles.status, 'approved'))
        .orderBy(sql`RAND()`)
        .limit(PICK_ATTEMPTS);
      for (const c of candidates) {
        const served = await load(c.id);
        if (served) return served;
      }
      return null;
    },
    async byId(id) {
      const [puzzle] = await db.select({ id: puzzles.id }).from(puzzles).where(and(eq(puzzles.id, id), eq(puzzles.status, 'approved'))).limit(1);
      return puzzle ? load(puzzle.id) : null;
    },
  };

  async function load(puzzleId: string): Promise<ServedPuzzle | null> {
    const puzzle = { id: puzzleId };
    {

      const groups = await db
        .select()
        .from(puzzleGroups)
        .where(eq(puzzleGroups.puzzleId, puzzle.id))
        .orderBy(asc(puzzleGroups.level));
      const items = await db
        .select({ groupId: puzzleGroupItems.groupId, productId: puzzleGroupItems.productId })
        .from(puzzleGroupItems)
        .where(eq(puzzleGroupItems.puzzleId, puzzle.id));
      const productIds = items.map((i) => i.productId);
      if (groups.length !== GROUP_COUNT || items.length !== GROUP_COUNT * GROUP_SIZE) return null;

      const productRows = await db
        .select({ id: products.id, nameFa: products.nameFa, unitFa: products.unitFa, iconKey: products.iconKey })
        .from(products)
        .where(inArray(products.id, productIds));

      const served: ServedPuzzle = {
        id: puzzle.id,
        groups: groups.map((g) => ({
          level: g.level as GroupLevel,
          productIds: items.filter((i) => i.groupId === g.id).map((i) => i.productId),
          titleFa: g.titleFa ?? '',
          explanationFa: g.explanationFa ?? '',
          ruleYear: g.ruleYear ?? undefined,
        })),
        items: Object.fromEntries(productRows.map((p) => [p.id, { nameFa: p.nameFa, unitFa: p.unitFa, iconKey: p.iconKey }])),
      };
      return served.groups.every((g) => g.productIds.length === GROUP_SIZE) ? served : null;
    }
  }
}
