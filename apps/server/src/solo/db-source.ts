import { asc, eq, inArray, products, puzzleGroupItems, puzzleGroups, puzzles, sql } from '@dozari/db';
import type { Db } from '@dozari/db';
import { GROUP_COUNT, GROUP_SIZE } from '@dozari/shared';
import type { GroupLevel } from '@dozari/shared';
import type { PuzzleSource, ServedPuzzle } from './types.js';

/** Serves a random `approved` puzzle with its groups and card texts. */
export function createDbPuzzleSource(db: Db): PuzzleSource {
  return {
    async pickRandom() {
      const [puzzle] = await db
        .select({ id: puzzles.id })
        .from(puzzles)
        .where(eq(puzzles.status, 'approved'))
        .orderBy(sql`RAND()`)
        .limit(1);
      if (!puzzle) return null;

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
        .select({ id: products.id, nameFa: products.nameFa, unitFa: products.unitFa })
        .from(products)
        .where(inArray(products.id, productIds));

      const served: ServedPuzzle = {
        id: puzzle.id,
        groups: groups.map((g) => ({
          level: g.level as GroupLevel,
          productIds: items.filter((i) => i.groupId === g.id).map((i) => i.productId),
          titleFa: g.titleFa ?? '',
          explanationFa: g.explanationFa ?? '',
        })),
        items: Object.fromEntries(productRows.map((p) => [p.id, { nameFa: p.nameFa, unitFa: p.unitFa }])),
      };
      return served.groups.every((g) => g.productIds.length === GROUP_SIZE) ? served : null;
    },
  };
}
