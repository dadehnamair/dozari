import { asc, count, eq, productCategories, products, puzzleGroups } from '@dozari/db';
import type { Db } from '@dozari/db';
import { PRODUCT_CATEGORIES } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';

/** A product category (دسته‌بندی محصولات) with how many products sit in it. */
export interface CategoryRow {
  id: string;
  slug: string;
  nameFa: string;
  sortOrder: number;
  isActive: boolean;
  products: number;
}

/** `id` set = edit (name, order, active flag; the slug never changes), unset = define a new one. */
export type CategoryInput = { id?: string; slug: string; nameFa: string; sortOrder: number; isActive: boolean };
export type SaveCategoryResult = { ok: true; id: string } | { ok: false; error: 'slug' | 'name' | 'duplicate' | 'not_found' };
export type DeleteCategoryResult = 'ok' | 'not_found' | 'in_use' | 'protected';

/** The category every product can fall back to; it cannot be deleted. */
export const FALLBACK_CATEGORY = 'other';

export const categorySlugOk = (slug: string): boolean => /^[a-z][a-z0-9_]{0,38}$/.test(slug);

export interface CategoryAdmin {
  /** All categories in admin order, with product counts. */
  list(): Promise<CategoryRow[]>;
  save(input: CategoryInput): Promise<SaveCategoryResult>;
  /** Only an unused category can go (move its products first); the fallback never. */
  remove(id: string): Promise<DeleteCategoryResult>;
  /** Slugs a product may be filed under right now (active ones). */
  activeSlugs(): Promise<string[]>;
}

/** Shared by the DB and memory admins: the checks that need no I/O. */
export function checkCategoryInput(input: CategoryInput): { slug: string; nameFa: string } | 'slug' | 'name' {
  const slug = input.slug.trim().toLowerCase();
  const nameFa = input.nameFa.trim();
  if (!categorySlugOk(slug)) return 'slug';
  if (nameFa.length < 2 || nameFa.length > 60) return 'name';
  return { slug, nameFa };
}

export function createDbCategoryAdmin(db: Db): CategoryAdmin {
  const rows = async () => db.select().from(productCategories).orderBy(asc(productCategories.sortOrder), asc(productCategories.nameFa));
  return {
    async list() {
      const used = await db.select({ category: products.category, n: count() }).from(products).groupBy(products.category);
      return (await rows()).map((r) => ({ id: r.id, slug: r.slug, nameFa: r.nameFa, sortOrder: r.sortOrder, isActive: r.isActive, products: Number(used.find((u) => u.category === r.slug)?.n ?? 0) }));
    },
    async save(input) {
      const ok = checkCategoryInput(input);
      if (typeof ok === 'string') return { ok: false, error: ok };
      if (input.id) {
        const [r] = await db.select().from(productCategories).where(eq(productCategories.id, input.id));
        if (!r) return { ok: false, error: 'not_found' };
        // The fallback stays switched on, so a product always has somewhere to go.
        await db.update(productCategories).set({ nameFa: ok.nameFa, sortOrder: input.sortOrder, isActive: r.slug === FALLBACK_CATEGORY ? true : input.isActive }).where(eq(productCategories.id, input.id));
        return { ok: true, id: input.id };
      }
      const [clash] = await db.select({ id: productCategories.id }).from(productCategories).where(eq(productCategories.slug, ok.slug));
      if (clash) return { ok: false, error: 'duplicate' };
      const id = uuidv7();
      await db.insert(productCategories).values({ id, slug: ok.slug, nameFa: ok.nameFa, sortOrder: input.sortOrder, isActive: input.isActive });
      return { ok: true, id };
    },
    async remove(id) {
      const [r] = await db.select().from(productCategories).where(eq(productCategories.id, id));
      if (!r) return 'not_found';
      if (r.slug === FALLBACK_CATEGORY) return 'protected';
      const [used] = await db.select({ n: count() }).from(products).where(eq(products.category, r.slug));
      const [ruled] = await db.select({ n: count() }).from(puzzleGroups).where(eq(puzzleGroups.ruleCategory, r.slug));
      if (Number(used?.n ?? 0) > 0 || Number(ruled?.n ?? 0) > 0) return 'in_use';
      await db.delete(productCategories).where(eq(productCategories.id, id));
      return 'ok';
    },
    async activeSlugs() {
      return (await rows()).filter((r) => r.isActive).map((r) => r.slug);
    },
  };
}

/** In-memory twin for tests, seeded like the migration. */
export function createMemoryCategoryAdmin(seed: readonly { slug: string; nameFa: string }[] = PRODUCT_CATEGORIES.map((c) => ({ slug: c, nameFa: c })), productCounts: () => Record<string, number> = () => ({})): CategoryAdmin {
  const list: Omit<CategoryRow, 'products'>[] = seed.map((c, i) => ({ id: `00000000-0000-7000-c000-${String(i + 1).padStart(12, '0')}`, slug: c.slug, nameFa: c.nameFa, sortOrder: i + 1, isActive: true }));
  return {
    async list() {
      return [...list].sort((a, b) => a.sortOrder - b.sortOrder).map((r) => ({ ...r, products: productCounts()[r.slug] ?? 0 }));
    },
    async save(input) {
      const ok = checkCategoryInput(input);
      if (typeof ok === 'string') return { ok: false, error: ok };
      if (input.id) {
        const r = list.find((x) => x.id === input.id);
        if (!r) return { ok: false, error: 'not_found' };
        Object.assign(r, { nameFa: ok.nameFa, sortOrder: input.sortOrder, isActive: r.slug === FALLBACK_CATEGORY ? true : input.isActive });
        return { ok: true, id: r.id };
      }
      if (list.some((x) => x.slug === ok.slug)) return { ok: false, error: 'duplicate' };
      const id = `00000000-0000-7000-c000-${String(list.length + 1).padStart(12, '0')}`;
      list.push({ id, slug: ok.slug, nameFa: ok.nameFa, sortOrder: input.sortOrder, isActive: input.isActive });
      return { ok: true, id };
    },
    async remove(id) {
      const i = list.findIndex((x) => x.id === id);
      if (i < 0) return 'not_found';
      if (list[i]!.slug === FALLBACK_CATEGORY) return 'protected';
      if ((productCounts()[list[i]!.slug] ?? 0) > 0) return 'in_use';
      list.splice(i, 1);
      return 'ok';
    },
    async activeSlugs() {
      return list.filter((x) => x.isActive).map((x) => x.slug);
    },
  };
}
