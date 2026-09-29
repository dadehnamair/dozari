import { pricePoints, products } from '@dozari/db';
import type { Db } from '@dozari/db';
import { and, asc, eq } from 'drizzle-orm';
import type { CatalogRepository, ProductDto } from './routes.js';

function toDto(row: typeof products.$inferSelect): ProductDto {
  return {
    id: row.id,
    slug: row.slug,
    nameFa: row.nameFa,
    brand: row.brand,
    category: row.category,
    unitFa: row.unitFa,
    audience: row.audience,
    eraTags: row.eraTags,
    storyFa: row.storyFa,
    status: row.status,
  };
}

export function createDbCatalogRepository(db: Db): CatalogRepository {
  return {
    async listProducts() {
      const rows = await db
        .select()
        .from(products)
        .where(eq(products.isActive, true))
        .orderBy(asc(products.slug));
      return rows.map(toDto);
    },
    async getProduct(id) {
      const [row] = await db
        .select()
        .from(products)
        .where(and(eq(products.id, id), eq(products.isActive, true)));
      return row ? toDto(row) : null;
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
