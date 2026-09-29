import {
  and,
  asc,
  eq,
  inArray,
  pricePoints,
  productAudiences,
  productEraTags,
  products,
} from '@dozari/db';
import type { Db } from '@dozari/db';
import type { CatalogRepository, ProductDto } from './routes.js';

function toDto(
  row: typeof products.$inferSelect,
  audience: string[],
  eraTags: string[],
): ProductDto {
  return {
    id: row.id,
    slug: row.slug,
    nameFa: row.nameFa,
    brand: row.brand,
    category: row.category,
    unitFa: row.unitFa,
    audience,
    eraTags,
    storyFa: row.storyFa,
    status: row.status,
  };
}

/** Attach the tag-table rows (audiences, era tags) to product rows. */
async function withTags(
  db: Db,
  rows: (typeof products.$inferSelect)[],
): Promise<ProductDto[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [audiences, eras] = await Promise.all([
    db.select().from(productAudiences).where(inArray(productAudiences.productId, ids)),
    db.select().from(productEraTags).where(inArray(productEraTags.productId, ids)),
  ]);
  return rows.map((row) =>
    toDto(
      row,
      audiences.filter((a) => a.productId === row.id).map((a) => a.audience).sort(),
      eras.filter((e) => e.productId === row.id).map((e) => e.tag).sort(),
    ),
  );
}

export function createDbCatalogRepository(db: Db): CatalogRepository {
  return {
    async listProducts() {
      const rows = await db
        .select()
        .from(products)
        .where(eq(products.isActive, true))
        .orderBy(asc(products.slug));
      return withTags(db, rows);
    },
    async getProduct(id) {
      const [row] = await db
        .select()
        .from(products)
        .where(and(eq(products.id, id), eq(products.isActive, true)));
      if (!row) return null;
      return (await withTags(db, [row]))[0] ?? null;
    },
    async listApprovedPrices(productId) {
      const rows = await db
        .select()
        .from(pricePoints)
        .where(and(eq(pricePoints.productId, productId), eq(pricePoints.status, 'approved')))
        .orderBy(asc(pricePoints.year), asc(pricePoints.month));
      return rows.map((r) => ({
        year: r.year,
        month: r.month,
        priceRials: r.priceRials.toString(),
        sourceType: r.sourceType,
        confidence: r.confidence,
      }));
    },
  };
}
