import { asc, eq, pricePoints, products } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { AdminRepository, AdminProductDto } from './routes.js';

/** MySQL duplicate-key error, whether raised directly or wrapped as a `cause`. */
function isDuplicateKey(err: unknown): boolean {
  const e = err as { code?: string; errno?: number; cause?: unknown } | null;
  if (!e) return false;
  return e.code === 'ER_DUP_ENTRY' || e.errno === 1062 || isDuplicateKey(e.cause);
}

export function createDbAdminRepository(db: Db): AdminRepository {
  return {
    async listCatalog() {
      const [productRows, priceRows] = await Promise.all([
        db.select().from(products).orderBy(asc(products.slug)),
        db
          .select()
          .from(pricePoints)
          .orderBy(asc(pricePoints.year), asc(pricePoints.month)),
      ]);
      return productRows.map(
        (p): AdminProductDto => ({
          id: p.id,
          slug: p.slug,
          nameFa: p.nameFa,
          unitFa: p.unitFa,
          prices: priceRows
            .filter((r) => r.productId === p.id)
            .map((r) => ({
              id: r.id,
              year: r.year,
              month: r.month,
              priceRials: r.priceRials.toString(),
              sourceType: r.sourceType,
              sourceUrl: r.sourceUrl,
              sourceNote: r.sourceNote,
              confidence: r.confidence,
              status: r.status,
            })),
        }),
      );
    },

    async setPriceStatus(priceId, status) {
      const [row] = await db
        .select({ id: pricePoints.id })
        .from(pricePoints)
        .where(eq(pricePoints.id, priceId));
      if (!row) return 'not_found';
      try {
        await db.update(pricePoints).set({ status }).where(eq(pricePoints.id, priceId));
      } catch (err) {
        // The unique key on (product, year, month, approved_flag) rejects a second approved row.
        if (isDuplicateKey(err)) return 'conflict';
        throw err;
      }
      return 'ok';
    },
  };
}
