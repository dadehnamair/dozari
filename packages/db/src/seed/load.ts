import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSeedProducts, seedFileSchema, seedPriceToRials } from '@dozari/shared';
import type { SeedProduct } from '@dozari/shared';
import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../client.js';
import { pricePoints, products } from '../schema.js';

export const SEED_DIR = join(fileURLToPath(new URL('../../seed/products', import.meta.url)));

/** Read + zod-validate every `seed/products/*.json`; throws with all problems listed. */
export function readSeedProducts(dir: string = SEED_DIR): SeedProduct[] {
  const all: SeedProduct[] = [];
  const problems: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
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
        audience: p.audience,
        eraTags: p.era_tags,
        storyFa: p.story_fa ?? null,
        status: p.status,
        updatedAt: new Date(),
      };
      const [row] = await tx
        .insert(products)
        .values(values)
        .onConflictDoUpdate({ target: products.slug, set: values })
        .returning({ id: products.id });
      if (!row) throw new Error(`upsert failed for ${p.slug}`);

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
          updatedAt: new Date(),
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
