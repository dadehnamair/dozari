import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { registerAdminModules } from '../admin/module-routes.js';
import { createMemoryCategoryAdmin } from '../admin/categories.js';
import { registerLookupRoutes } from '../catalog/routes.js';

describe('product categories admin', () => {
  it('defines, renames, switches off and deletes categories', async () => {
    const used: Record<string, number> = { food: 3 };
    const cats = createMemoryCategoryAdmin([{ slug: 'food', nameFa: 'خوراکی' }, { slug: 'other', nameFa: 'متفرقه' }], () => used);
    expect(await cats.save({ slug: 'Stationery', nameFa: 'لوازم‌التحریر', sortOrder: 5, isActive: true })).toMatchObject({ ok: true });
    expect(await cats.save({ slug: 'stationery', nameFa: 'تکرار', sortOrder: 6, isActive: true })).toEqual({ ok: false, error: 'duplicate' });
    expect(await cats.save({ slug: '1bad', nameFa: 'بد', sortOrder: 1, isActive: true })).toEqual({ ok: false, error: 'slug' });
    expect(await cats.save({ slug: 'x', nameFa: 'ا', sortOrder: 1, isActive: true })).toEqual({ ok: false, error: 'name' });
    const list = await cats.list();
    const st = list.find((c) => c.slug === 'stationery')!;
    expect(await cats.save({ id: st.id, slug: 'ignored', nameFa: 'نوشت‌افزار', sortOrder: 5, isActive: false })).toMatchObject({ ok: true });
    expect((await cats.list()).find((c) => c.id === st.id)).toMatchObject({ slug: 'stationery', nameFa: 'نوشت‌افزار', isActive: false });
    expect(await cats.activeSlugs()).not.toContain('stationery');
    // The fallback stays on and cannot go; a category with products cannot go.
    const other = list.find((c) => c.slug === 'other')!;
    await cats.save({ id: other.id, slug: 'other', nameFa: 'متفرقه', sortOrder: 9, isActive: false });
    expect(await cats.activeSlugs()).toContain('other');
    expect(await cats.remove(other.id)).toBe('protected');
    expect(await cats.remove(list.find((c) => c.slug === 'food')!.id)).toBe('in_use');
    expect(await cats.remove(st.id)).toBe('ok');
  });

  it('serves the admin routes and the public lookup list', async () => {
    const app = Fastify();
    const cats = createMemoryCategoryAdmin([{ slug: 'food', nameFa: 'خوراکی' }, { slug: 'other', nameFa: 'متفرقه' }]);
    registerAdminModules(app, { categories: cats } as never);
    const made = await app.inject({ method: 'POST', url: '/admin/product-categories', payload: { slug: 'toys', nameFa: 'اسباب‌بازی', sortOrder: 3 } });
    expect(made.statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: '/admin/product-categories', payload: { slug: 'toys', nameFa: 'تکرار' } })).statusCode).toBe(400);
    const meta = (await app.inject({ method: 'GET', url: '/admin/meta' })).json();
    expect(meta.categories).toContain('toys');
    expect(meta.categoryNames.toys).toBe('اسباب‌بازی');
    const pub = Fastify();
    registerLookupRoutes(pub, {} as never, async () => (await cats.list()).filter((c) => c.isActive).map((c) => ({ slug: c.slug, nameFa: c.nameFa })));
    expect((await pub.inject({ method: 'GET', url: '/lookup/categories' })).json().categories.map((c: { slug: string }) => c.slug)).toEqual(['food', 'other', 'toys']);
  });
});
