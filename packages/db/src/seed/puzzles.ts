import { and, eq, inArray, like } from 'drizzle-orm';
import { explainRule, generatePuzzle, mulberry32 } from '@dozari/shared';
import type { Catalog, SeedPuzzle } from '@dozari/shared';
import type { Db } from '../client.js';
import { ruleToColumns } from '../puzzle-rule.js';
import { pricePoints, productEraTags, products, puzzleGroupItems, puzzleGroups, puzzles } from '../schema.js';

/** Marker in `puzzle_groups.rule_note` of everything the sample seed makes, so it can be found and removed again. */
export const SEED_NOTE_PREFIX = 'seed:';
export const SAMPLE_SLUG_PREFIX = 'sample-';

/** Curated puzzles of `seed/puzzles/*.json` as approved puzzles; one that is already there (same id) is left alone. Returns how many were made. */
export async function loadSeedPuzzles(db: Db, seed: readonly SeedPuzzle[]): Promise<number> {
  let made = 0;
  for (const sp of seed) {
    const note = `${SEED_NOTE_PREFIX}${sp.id}`;
    const [exists] = await db.select({ id: puzzleGroups.id }).from(puzzleGroups).where(eq(puzzleGroups.ruleNote, note)).limit(1);
    if (exists) continue;
    const slugs = sp.groups.flatMap((g) => g.products);
    const rows = await db.select({ id: products.id, slug: products.slug }).from(products).where(inArray(products.slug, slugs));
    const idOf = new Map(rows.map((r) => [r.slug, r.id]));
    if (slugs.some((s) => !idOf.has(s))) throw new Error(`puzzle ${sp.id}: a product is not in the database (run the product seed first)`);
    await db.transaction(async (tx) => {
      const [puzzle] = await tx.insert(puzzles).values({ status: 'approved', source: 'curated' }).$returningId();
      if (!puzzle) throw new Error('puzzle insert failed');
      for (const g of sp.groups) {
        const [group] = await tx
          .insert(puzzleGroups)
          .values({ puzzleId: puzzle.id, level: g.level, titleFa: g.title_fa, explanationFa: g.explanation_fa, ruleKind: 'curated', ruleNote: note })
          .$returningId();
        if (!group) throw new Error('group insert failed');
        await tx.insert(puzzleGroupItems).values(g.products.map((s) => ({ groupId: group.id, puzzleId: puzzle.id, productId: idOf.get(s)! })));
      }
    });
    made += 1;
  }
  return made;
}

/**
 * Up to `count` more approved puzzles made by the real generator from the sample products (rule-checked, one solution each), titled with the
 * rule in plain Persian. Sample data only: real puzzles go through the admin's review. Returns how many were made.
 */
export async function generateSamplePuzzles(db: Db, count: number, seed = 20261003): Promise<number> {
  const rows = await db
    .select({ id: products.id, category: products.category, year: pricePoints.year, month: pricePoints.month, price: pricePoints.priceRials })
    .from(products)
    .innerJoin(pricePoints, and(eq(pricePoints.productId, products.id), eq(pricePoints.status, 'approved')))
    .where(and(like(products.slug, `${SAMPLE_SLUG_PREFIX}%`), eq(products.isActive, true)));
  const tags = await db.select({ productId: productEraTags.productId, tag: productEraTags.tag }).from(productEraTags);
  const byId = new Map<string, { id: string; category: string; eraTags: string[]; prices: { year: number; month: number | null; priceRials: bigint }[] }>();
  for (const r of rows) {
    const p = byId.get(r.id) ?? byId.set(r.id, { id: r.id, category: r.category, eraTags: [], prices: [] }).get(r.id)!;
    p.prices.push({ year: r.year, month: r.month, priceRials: BigInt(r.price) });
  }
  for (const t of tags) byId.get(t.productId)?.eraTags.push(t.tag);
  const catalog: Catalog = [...byId.values()].filter((p) => new Set(p.prices.map((x) => x.year)).size >= 3);
  const rng = mulberry32(seed + (await db.select({ id: puzzles.id }).from(puzzles)).length);
  const seen = new Set<string>();
  let made = 0;
  for (let tries = 0; tries < count * 12 && made < count; tries++) {
    const g = generatePuzzle(catalog, rng);
    if (!g) break;
    const key = g.groups.flatMap((x) => x.productIds).sort().join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    await db.transaction(async (tx) => {
      const [puzzle] = await tx.insert(puzzles).values({ status: 'approved', source: 'generated' }).$returningId();
      if (!puzzle) throw new Error('puzzle insert failed');
      for (const grp of g.groups) {
        const text = explainRule(grp.rule);
        const [group] = await tx
          .insert(puzzleGroups)
          .values({ puzzleId: puzzle.id, level: grp.level, titleFa: text.slice(0, 100), explanationFa: text.slice(0, 300), ...ruleToColumns(grp.rule), ruleNote: `${SEED_NOTE_PREFIX}generated` })
          .$returningId();
        if (!group) throw new Error('group insert failed');
        await tx.insert(puzzleGroupItems).values(grp.productIds.map((productId) => ({ groupId: group.id, puzzleId: puzzle.id, productId })));
      }
    });
    made += 1;
  }
  return made;
}

/** Removes everything the sample seed made: its puzzles (marked in `rule_note`) and its `sample-*` products with their prices. */
export async function removeSampleData(db: Db): Promise<{ puzzles: number; products: number }> {
  const marked = await db.select({ puzzleId: puzzleGroups.puzzleId }).from(puzzleGroups).where(like(puzzleGroups.ruleNote, `${SEED_NOTE_PREFIX}%`));
  const puzzleIds = [...new Set(marked.map((m) => m.puzzleId))];
  if (puzzleIds.length > 0) await db.delete(puzzles).where(inArray(puzzles.id, puzzleIds));
  const sample = await db.select({ id: products.id }).from(products).where(like(products.slug, `${SAMPLE_SLUG_PREFIX}%`));
  if (sample.length > 0) await db.delete(products).where(like(products.slug, `${SAMPLE_SLUG_PREFIX}%`));
  return { puzzles: puzzleIds.length, products: sample.length };
}
