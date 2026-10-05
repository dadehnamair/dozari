import { and, asc, eq, inArray, itemLessons, products } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { AdminLessonRow, LessonStore } from './service.js';

/** Persistence of word lessons (`item_lessons`); kid items are the `products` rows with `age_track = 'kid'`. */
export function createDbLessonStore(db: Db): LessonStore {
  return {
    async approvedFor(productIds) {
      if (productIds.length === 0) return [];
      const rows = await db
        .select({ productId: itemLessons.productId, wordFa: itemLessons.wordFa, storyFa: itemLessons.storyFa, syllablesFa: itemLessons.syllablesFa })
        .from(itemLessons)
        .where(and(inArray(itemLessons.productId, [...productIds]), eq(itemLessons.status, 'approved')));
      return rows;
    },
    async listKidItems(status) {
      const rows = await db
        .select({ productId: products.id, nameFa: products.nameFa, iconKey: products.iconKey, l: itemLessons })
        .from(products)
        .leftJoin(itemLessons, eq(itemLessons.productId, products.id))
        .where(and(eq(products.ageTrack, 'kid'), eq(products.isActive, true)))
        .orderBy(asc(products.nameFa));
      const out: AdminLessonRow[] = rows.map((r) => ({
        productId: r.productId,
        nameFa: r.nameFa,
        iconKey: r.iconKey,
        lesson: r.l ? { wordFa: r.l.wordFa, storyFa: r.l.storyFa, syllablesFa: r.l.syllablesFa, status: r.l.status, reviewedAt: r.l.reviewedAt?.getTime() ?? null } : null,
      }));
      if (!status) return out;
      return out.filter((r) => (status === 'missing' ? r.lesson === null : r.lesson?.status === status));
    },
    async save(productId, input) {
      const [p] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId));
      if (!p) return false;
      await db
        .insert(itemLessons)
        .values({ productId, ...input, status: 'draft' })
        .onDuplicateKeyUpdate({ set: { ...input, status: 'draft', reviewedBy: null, reviewedAt: null } });
      return true;
    },
    async setStatus(productId, status, reviewer) {
      const [res] = await db
        .update(itemLessons)
        .set({ status, reviewedBy: status === 'approved' ? reviewer : null, reviewedAt: status === 'approved' ? new Date() : null })
        .where(eq(itemLessons.productId, productId));
      return res.affectedRows > 0 ? 'ok' : 'not_found';
    },
  };
}
