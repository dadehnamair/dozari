import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSeedProducts, checkSeedPuzzles, seedFileSchema, seedPriceToRials, seedPuzzleFileSchema } from '@dozari/shared';
import type { SeedProduct, SeedPuzzle } from '@dozari/shared';
import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../client.js';
import { itemLessons, pricePoints, productAudiences, productEraTags, products } from '../schema.js';

/** A seed folder may be absent (git does not keep empty directories): that just means no seed files. */
const jsonFiles = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : []);

export const SEED_DIR = join(fileURLToPath(new URL('../../seed/products', import.meta.url)));
export const PUZZLE_SEED_DIR = join(fileURLToPath(new URL('../../seed/puzzles', import.meta.url)));

/**
 * Read + validate `seed/puzzles/*.json`: every slug must be in `known` (the catalogue index + dev seed products, see `knownProductSlugs`).
 * Which age track a product belongs to is only known to the database, so that check runs when the puzzles are loaded.
 */
export function readSeedPuzzles(known: ReadonlySet<string>, dir: string = PUZZLE_SEED_DIR): SeedPuzzle[] {
  const all: SeedPuzzle[] = [];
  const problems: string[] = [];
  for (const file of jsonFiles(dir)) {
    const parsed = seedPuzzleFileSchema.safeParse(JSON.parse(readFileSync(join(dir, file), 'utf8')));
    if (!parsed.success) problems.push(...parsed.error.issues.map((i) => `${file}: ${i.path.join('.')}: ${i.message}`));
    else all.push(...parsed.data);
  }
  // Offline every known slug counts as the most permissive track; the real age track of a product is enforced against the database on load.
  problems.push(...checkSeedPuzzles(all, known, new Map([...known].map((slug) => [slug, 'kid'] as const))));
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

/**
 * Insert-only and idempotent by `slug` and `(slug, year, month)`: a product that already exists is left exactly as it is
 * (name, texts, tags, status and prices may have been edited in the admin panel), only missing products and price points are added.
 */
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
        ageTrack: p.age_track,
      };
      const [found] = await tx.select({ id: products.id }).from(products).where(eq(products.slug, p.slug));
      const isNew = !found;
      // MySQL has no RETURNING: insert, then look the id up by its unique slug.
      if (isNew) await tx.insert(products).values(values);
      const [row] = isNew ? await tx.select({ id: products.id }).from(products).where(eq(products.slug, p.slug)) : [found];
      if (!row) throw new Error(`insert failed for ${p.slug}`);

      // A kid word lesson is seeded once, as a draft; an edit or approval made in the admin is never overwritten.
      if (p.lesson) {
        await tx
          .insert(itemLessons)
          .ignore()
          .values({ productId: row.id, wordFa: p.lesson.word_fa, storyFa: p.lesson.story_fa, syllablesFa: p.lesson.syllables_fa ?? null, status: 'draft' });
      }

      // Tags belong to the seed only for a product it just created; an existing one keeps what the admin set.
      if (isNew && p.audience.length > 0) {
        await tx.insert(productAudiences).values(p.audience.map((audience) => ({ productId: row.id, audience })));
      }
      if (isNew && p.era_tags.length > 0) {
        await tx.insert(productEraTags).values(p.era_tags.map((tag) => ({ productId: row.id, tag })));
      }
      // Theme tags (`theme:kitchen`…) are additive: a catalog loaded before they existed picks them up, nothing else of its tags is touched.
      const themeTags = p.era_tags.filter((tag) => tag.startsWith('theme:'));
      if (!isNew && themeTags.length > 0) {
        await tx.insert(productEraTags).ignore().values(themeTags.map((tag) => ({ productId: row.id, tag })));
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
        if (!existing) await tx.insert(pricePoints).values(point);
      }
    }
  });
}
