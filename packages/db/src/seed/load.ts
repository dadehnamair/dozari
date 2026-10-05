import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSeedProducts, checkSeedPuzzles, seedFileSchema, seedPriceToRials, seedPuzzleFileSchema } from '@dozari/shared';
import type { SeedProduct, SeedPuzzle } from '@dozari/shared';
import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../client.js';
import { pricePoints, productAudiences, productEraTags, products } from '../schema.js';

/** A seed folder may be absent (git does not keep empty directories): that just means no seed files. */
const jsonFiles = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : []);

export const SEED_DIR = join(fileURLToPath(new URL('../../seed/products', import.meta.url)));
export const PUZZLE_SEED_DIR = join(fileURLToPath(new URL('../../seed/puzzles', import.meta.url)));

/** Read + validate `seed/puzzles/*.json` against the catalog seed (every slug must exist). */
export function readSeedPuzzles(products: readonly SeedProduct[] = readSeedProducts(), dir: string = PUZZLE_SEED_DIR): SeedPuzzle[] {
  const all: SeedPuzzle[] = [];
  const problems: string[] = [];
  for (const file of jsonFiles(dir)) {
    const parsed = seedPuzzleFileSchema.safeParse(JSON.parse(readFileSync(join(dir, file), 'utf8')));
    if (!parsed.success) problems.push(...parsed.error.issues.map((i) => `${file}: ${i.path.join('.')}: ${i.message}`));
    else all.push(...parsed.data);
  }
  problems.push(...checkSeedPuzzles(all, new Set(products.map((p) => p.slug))));
  if (problems.length > 0) throw new Error(`Invalid puzzle seed:\n${problems.join('\n')}`);
  return all;
}

/** Read + zod-validate every `seed/products/*.json`; throws with all problems listed. */
export function readSeedProducts(dir: string = SEED_DIR): SeedProduct[] {
  const all: SeedProduct[] = [];
  const problems: string[] = [];
  for (const file of jsonFiles(dir)) {
    const parsed = seedFileSchema.safeParse(JSON.parse(readFileSync(join(dir, file), 'utf8')));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push(`${file}: ${issue.path.join('.')}: ${issue.message}`);
      }
      continue;
    }
    all.push(...parsed.data);
  }
  problems.push(...checkSeedProducts(all));
  if (problems.length > 0) throw new Error(`Invalid seed data:\n${problems.join('\n')}`);
  return all;
}

/** Idempotent by `slug` and `(slug, year, month)`; re-running updates rows in place. */
export async function loadSeed(db: Db, seed: readonly SeedProduct[] = readSeedProducts()) {
  await db.transaction(async (tx) => {
    for (const p of seed) {
      const values = {
        slug: p.slug,
        nameFa: p.name_fa,
        brand: p.brand ?? null,
        category: p.category,
        unitFa: p.unit_fa ?? null,
        iconKey: p.icon_key ?? null,
        storyFa: p.story_fa ?? null,
        status: p.status,
      };
      // MySQL has no RETURNING: upsert, then look the id up by its unique slug.
      await tx
        .insert(products)
        .values(values)
        .onDuplicateKeyUpdate({ set: { ...values, updatedAt: new Date() } });
      const [row] = await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.slug, p.slug));
      if (!row) throw new Error(`upsert failed for ${p.slug}`);

      // Tag tables are fully owned by the seed: replace them so removed tags disappear.
      await tx.delete(productAudiences).where(eq(productAudiences.productId, row.id));
      if (p.audience.length > 0) {
        await tx
          .insert(productAudiences)
          .values(p.audience.map((audience) => ({ productId: row.id, audience })));
      }
      await tx.delete(productEraTags).where(eq(productEraTags.productId, row.id));
      if (p.era_tags.length > 0) {
        await tx
          .insert(productEraTags)
          .values(p.era_tags.map((tag) => ({ productId: row.id, tag })));
      }

      for (const pt of p.prices) {
        const month = pt.month ?? null;
        const point = {
          productId: row.id,
          year: pt.year,
          month,
          priceRials: seedPriceToRials(pt),
          sourceType: pt.source_type,
          sourceUrl: pt.source_url ?? null,
          sourceNote: pt.source_note ?? null,
          confidence: pt.confidence,
          status: pt.status,
        };
        // NULL months are distinct in a unique index, so match manually.
        const [existing] = await tx
          .select({ id: pricePoints.id })
          .from(pricePoints)
          .where(
            and(
              eq(pricePoints.productId, row.id),
              eq(pricePoints.year, pt.year),
              month === null ? isNull(pricePoints.month) : eq(pricePoints.month, month),
              eq(pricePoints.status, pt.status),
            ),
          );
        if (existing) await tx.update(pricePoints).set(point).where(eq(pricePoints.id, existing.id));
        else await tx.insert(pricePoints).values(point);
      }
    }
  });
}
