import { and, eq, inArray, pricePoints, products, sql } from '@dozari/db';
import type { Db } from '@dozari/db';
import { MIN_PRICE_POINTS_PER_PRODUCT } from '@dozari/shared';
import type { CatalogProduct } from '@dozari/shared';
import type { PriceOnlySource } from './service.js';

/** Random active products with at least `MIN_PRICE_POINTS_PER_PRODUCT` approved prices, and those prices. */
export function createDbPriceOnlySource(db: Db): PriceOnlySource {
  return {
    async products(limit) {
      const picked = await db
        .select({ id: products.id, category: products.category, nameFa: products.nameFa, unitFa: products.unitFa, iconKey: products.iconKey })
        .from(products)
        .where(
          and(
            eq(products.isActive, true),
            sql`(SELECT COUNT(*) FROM ${pricePoints} WHERE ${pricePoints.productId} = ${products.id} AND ${pricePoints.status} = 'approved') >= ${MIN_PRICE_POINTS_PER_PRODUCT}`,
          ),
        )
        .orderBy(sql`RAND()`)
        .limit(limit);
      if (picked.length === 0) return { catalog: [], items: {} };
      const rows = await db
        .select({ productId: pricePoints.productId, year: pricePoints.year, month: pricePoints.month, priceRials: pricePoints.priceRials })
        .from(pricePoints)
        .where(and(inArray(pricePoints.productId, picked.map((p) => p.id)), eq(pricePoints.status, 'approved')));
      const catalog: CatalogProduct[] = picked.map((p) => ({
        id: p.id,
        category: p.category,
        eraTags: [],
        prices: rows.filter((r) => r.productId === p.id).map((r) => ({ year: r.year, month: r.month, priceRials: BigInt(r.priceRials) })),
      }));
      return { catalog, items: Object.fromEntries(picked.map((p) => [p.id, { nameFa: p.nameFa, unitFa: p.unitFa, iconKey: p.iconKey }])) };
    },
  };
}
