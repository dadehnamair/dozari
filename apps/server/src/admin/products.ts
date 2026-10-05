import { asc, eq, pricePoints, products } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';
import { PRODUCT_CATEGORIES, isItemIconKey } from '@dozari/shared';
import type { AgeTrack } from '@dozari/shared';

export interface ProductPatch {
  nameFa?: string;
  unitFa?: string | null;
  brand?: string | null;
  category?: string;
  storyFa?: string | null;
  iconKey?: string | null;
  isActive?: boolean;
  /** Lowest age track the item is meant for (D198). */
  ageTrack?: AgeTrack;
  status?: 'in_production' | 'discontinued' | 'changed';
}

export interface NewProduct {
  slug: string;
  nameFa: string;
  category: string;
  unitFa?: string | null;
  iconKey?: string | null;
  ageTrack?: AgeTrack;
}

export interface NewPrice {
  productId: string;
  year: number;
  month: number | null;
  priceRials: bigint;
  sourceType: 'archive_newspaper' | 'official_list' | 'receipt_photo' | 'website' | 'user_memory' | 'other';
  sourceUrl?: string | null;
  sourceNote?: string | null;
  confidence: number;
}

export interface ProductAdmin {
  /** Product fields beyond the review list: category, icon, active flag, story, brand. */
  details(): Promise<Record<string, { category: string; iconKey: string | null; isActive: boolean; brand: string | null; storyFa: string | null; status: string; ageTrack: AgeTrack }>>;
  update(id: string, patch: ProductPatch): Promise<'ok' | 'not_found' | 'invalid'>;
  create(input: NewProduct): Promise<{ id: string } | 'duplicate' | 'invalid'>;
  /** A price typed by hand; always stored as pending so the review step still applies. */
  addPrice(input: NewPrice): Promise<{ id: string } | 'duplicate' | 'not_found'>;
}

const slugOk = /^[a-z0-9][a-z0-9-]{1,98}$/;

function isDuplicateKey(err: unknown): boolean {
  const e = err as { code?: string; errno?: number; cause?: unknown } | null;
  return Boolean(e && (e.code === 'ER_DUP_ENTRY' || e.errno === 1062 || isDuplicateKey(e.cause)));
}

export function validCategory(c: string): boolean {
  return (PRODUCT_CATEGORIES as readonly string[]).includes(c);
}

export function createDbProductAdmin(db: Db): ProductAdmin {
  return {
    async details() {
      const rows = await db.select().from(products).orderBy(asc(products.slug));
      return Object.fromEntries(
        rows.map((p) => [p.id, { category: p.category, iconKey: p.iconKey, isActive: p.isActive, brand: p.brand, storyFa: p.storyFa, status: p.status, ageTrack: p.ageTrack }]),
      );
    },
    async update(id, patch) {
      if (patch.iconKey && !isItemIconKey(patch.iconKey)) return 'invalid';
      if (patch.category && !validCategory(patch.category)) return 'invalid';
      const set = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      if (Object.keys(set).length === 0) return 'invalid';
      const [row] = await db.select({ id: products.id }).from(products).where(eq(products.id, id));
      if (!row) return 'not_found';
      await db.update(products).set(set).where(eq(products.id, id));
      return 'ok';
    },
    async create(input) {
      if (!slugOk.test(input.slug) || !validCategory(input.category)) return 'invalid';
      if (input.iconKey && !isItemIconKey(input.iconKey)) return 'invalid';
      const id = uuidv7();
      try {
        await db.insert(products).values({
          id,
          slug: input.slug,
          nameFa: input.nameFa,
          category: input.category as (typeof products.$inferInsert)['category'],
          unitFa: input.unitFa ?? null,
          iconKey: input.iconKey ?? null,
          ageTrack: input.ageTrack ?? 'adult',
        });
      } catch (err) {
        if (isDuplicateKey(err)) return 'duplicate';
        throw err;
      }
      return { id };
    },
    async addPrice(input) {
      const [p] = await db.select({ id: products.id }).from(products).where(eq(products.id, input.productId));
      if (!p) return 'not_found';
      const id = uuidv7();
      try {
        await db.insert(pricePoints).values({
          id,
          productId: input.productId,
          year: input.year,
          month: input.month,
          priceRials: input.priceRials,
          sourceType: input.sourceType,
          sourceUrl: input.sourceUrl ?? null,
          sourceNote: input.sourceNote ?? null,
          confidence: input.confidence,
          status: 'pending',
        });
      } catch (err) {
        if (isDuplicateKey(err)) return 'duplicate';
        throw err;
      }
      return { id };
    },
  };
}

