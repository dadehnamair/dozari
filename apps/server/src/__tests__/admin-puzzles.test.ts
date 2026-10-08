import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@dozari/shared';
import type { CatalogProduct } from '@dozari/shared';
import { buildServer } from '../index.js';
import { createMemoryAuditLog } from '../admin/audit.js';
import { checkShape, createMemoryPuzzleAdmin } from '../puzzles/admin.js';

const TOKEN = 'secret-admin-token';
const ids = Array.from({ length: 16 }, (_, i) => `00000000-0000-7000-8000-${String(i + 1).padStart(12, '0')}`);
const groupsOf = (list: string[]) => [0, 1, 2, 3].map((level) => ({ level, titleFa: `دسته‌ی ${level + 1}`, explanationFa: 'همه‌شان یک چیز بودند', productIds: list.slice(level * 4, level * 4 + 4) }));

const YEARS = [1365, 1370, 1375, 1380, 1385, 1390, 1395, 1400];
/** 150 products whose prices grow at random speeds: enough structure for the generator. */
function richCatalog(): CatalogProduct[] {
  const rng = mulberry32(11);
  return Array.from({ length: 150 }, (_, i) => {
    let price = Math.floor(10 ** (1 + rng() * 3));
    const prices = YEARS.map((year) => {
      const row = { year, month: null, priceRials: BigInt(price) };
      price = Math.floor(price * (1.5 + rng() * 5));
      return row;
    });
    return { id: `00000000-0000-7000-7000-${String(i + 1).padStart(12, '0')}`, category: ['food', 'snack', 'drink', 'car', 'electronics'][i % 5] as string, eraTags: i % 3 === 0 ? ['dahe-60'] : [], prices };
  });
}

function boot(catalog: CatalogProduct[] = []) {
  const puzzles = createMemoryPuzzleAdmin(new Set([...ids, ...catalog.map((p) => p.id)]), catalog);
  const audit = createMemoryAuditLog();
  const app = buildServer({
    admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: TOKEN },
    adminModules: { audit, puzzles },
  });
  const h = { 'x-admin-token': TOKEN };
  return { app, h, puzzles };
}

describe('hand-built puzzles in the admin panel', () => {
  it('shape rules: 4 groups, levels 0–3 once, 4 products each, 16 distinct', () => {
    expect(checkShape(groupsOf(ids))).toBe('ok');
    expect(checkShape(groupsOf(ids).slice(0, 3))).toBe('shape');
    expect(checkShape(groupsOf([...ids.slice(0, 15), ids[0]!]))).toBe('duplicate_product');
    const sameLevel = groupsOf(ids);
    sameLevel[1]!.level = 0;
    expect(checkShape(sameLevel)).toBe('shape');
  });

  it('creates a playable puzzle, lists it with readiness, retires and re-approves it', async () => {
    const { app, h } = boot();
    const made = await app.inject({ method: 'POST', url: '/admin/puzzles', headers: h, payload: { groups: groupsOf(ids) } });
    expect(made.statusCode).toBe(201);
    const id = made.json().id as string;
    const list = (await app.inject({ method: 'GET', url: '/admin/puzzles', headers: h })).json();
    expect(list.readiness).toMatchObject({ products: 16, approvedPuzzles: 1, productsPerPuzzle: 16 });
    expect(list.puzzles[0]).toMatchObject({ id, status: 'approved', source: 'curated' });
    expect((await app.inject({ method: 'PATCH', url: `/admin/puzzles/${id}`, headers: h, payload: { status: 'retired' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/admin/puzzles', headers: h })).json().readiness.approvedPuzzles).toBe(0);
  });

  it('refuses a repeated product, an unknown product and a short group', async () => {
    const { app, h } = boot();
    const dup = await app.inject({ method: 'POST', url: '/admin/puzzles', headers: h, payload: { groups: groupsOf([...ids.slice(0, 15), ids[0]!]) } });
    expect(dup.json()).toEqual({ error: 'duplicate_product' });
    const unknown = groupsOf(ids);
    unknown[3]!.productIds[3] = '00000000-0000-7000-8000-0000000000ff';
    expect((await app.inject({ method: 'POST', url: '/admin/puzzles', headers: h, payload: { groups: unknown } })).statusCode).toBe(404);
    const short = groupsOf(ids);
    short[0]!.productIds = short[0]!.productIds.slice(0, 3);
    expect((await app.inject({ method: 'POST', url: '/admin/puzzles', headers: h, payload: { groups: short } })).statusCode).toBe(400);
  });

  it('generates drafts from the catalog, lets the admin write titles, then approve', async () => {
    const { app, h } = boot(richCatalog());
    const out = (await app.inject({ method: 'POST', url: '/admin/puzzles/generate', headers: h, payload: { count: 3 } })).json();
    expect(out).toMatchObject({ requested: 3, created: 3, catalogSize: 150 });
    const list = (await app.inject({ method: 'GET', url: '/admin/puzzles', headers: h })).json();
    const drafts = list.puzzles.filter((p: { status: string }) => p.status === 'draft');
    expect(drafts).toHaveLength(3);
    expect(drafts[0].source).toBe('generated');
    const id = drafts[0].id as string;
    expect(drafts[0].groups.every((g: { titleFa: string }) => g.titleFa.length > 2)).toBe(true); // a plain explanation stands in as title
    const titles = [0, 1, 2, 3].map((level) => ({ level, titleFa: `عنوان بامزه ${level}` }));
    expect((await app.inject({ method: 'PUT', url: `/admin/puzzles/${id}/titles`, headers: h, payload: { titles } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PATCH', url: `/admin/puzzles/${id}`, headers: h, payload: { status: 'approved' } })).statusCode).toBe(200);
    const after = (await app.inject({ method: 'GET', url: '/admin/puzzles', headers: h })).json();
    expect(after.puzzles.find((p: { id: string }) => p.id === id)).toMatchObject({ status: 'approved' });
    expect(after.puzzles.find((p: { id: string }) => p.id === id).groups[0].titleFa).toBe('عنوان بامزه 0');
  }, 30_000);

  it('makes drafts for the chosen tier, or spreads them over the tiers, and rejects an unknown tier', async () => {
    const { app, h } = boot(richCatalog());
    const tiers = (await app.inject({ method: 'GET', url: '/admin/puzzles/tiers', headers: h })).json().tiers as { id: string }[];
    const spread = (await app.inject({ method: 'POST', url: '/admin/puzzles/generate', headers: h, payload: { count: 2 } })).json();
    expect(spread.created).toBe(2);
    const one = (await app.inject({ method: 'POST', url: '/admin/puzzles/generate', headers: h, payload: { count: 2, tierId: tiers[4]!.id } })).json();
    expect(one.created).toBe(2);
    const list = (await app.inject({ method: 'GET', url: '/admin/puzzles', headers: h })).json().puzzles as { id: string; tierId: string | null }[];
    for (const id of one.ids as string[]) expect(list.find((p) => p.id === id)!.tierId).toBe(tiers[4]!.id);
    expect(new Set((spread.ids as string[]).map((id) => list.find((p) => p.id === id)!.tierId)).size).toBe(2);
    const bad = await app.inject({ method: 'POST', url: '/admin/puzzles/generate', headers: h, payload: { count: 1, tierId: '00000000-0000-7000-8000-00000000ffff' } });
    expect(bad.statusCode).toBe(404);
  }, 60_000);

  it('says how many it could make when the catalog is too small', async () => {
    const { app, h } = boot();
    const out = (await app.inject({ method: 'POST', url: '/admin/puzzles/generate', headers: h, payload: { count: 2 } })).json();
    expect(out).toMatchObject({ created: 0, catalogSize: 0 });
    expect((await app.inject({ method: 'POST', url: '/admin/puzzles/generate', headers: h, payload: { count: 0 } })).statusCode).toBe(400);
  });
});

describe('puzzle tiers in the admin panel', () => {
  it('starts with five default tiers and lets the admin add, edit and delete them', async () => {
    const { app, h } = boot();
    const first = (await app.inject({ method: 'GET', url: '/admin/puzzles/tiers', headers: h })).json().tiers as { id: string; nameFa: string }[];
    expect(first.map((t) => t.nameFa)).toEqual(['خیلی آسان', 'آسان', 'متوسط', 'سخت', 'خیلی سخت']);
    const add = await app.inject({ method: 'POST', url: '/admin/puzzles/tiers', headers: h, payload: { nameFa: 'مبتدی ویژه', sortOrder: 0, minLevel: 1, maxLevel: 2 } });
    expect(add.statusCode).toBe(200);
    const id = add.json().id as string;
    const edit = await app.inject({ method: 'POST', url: '/admin/puzzles/tiers', headers: h, payload: { id, nameFa: 'مبتدی', sortOrder: 0, minLevel: 1, maxLevel: null } });
    expect(edit.statusCode).toBe(200);
    const after = (await app.inject({ method: 'GET', url: '/admin/puzzles/tiers', headers: h })).json().tiers as { id: string; nameFa: string; maxLevel: number | null }[];
    expect(after[0]).toMatchObject({ id, nameFa: 'مبتدی', maxLevel: null });
    expect((await app.inject({ method: 'DELETE', url: `/admin/puzzles/tiers/${id}`, headers: h })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/admin/puzzles/tiers/${id}`, headers: h })).statusCode).toBe(404);
  });

  it('refuses a nameless tier and a max level below the min', async () => {
    const { app, h } = boot();
    const bad = (payload: object) => app.inject({ method: 'POST', url: '/admin/puzzles/tiers', headers: h, payload });
    expect((await bad({ nameFa: ' ', sortOrder: 1, minLevel: 1, maxLevel: null })).statusCode).toBe(400);
    const range = await bad({ nameFa: 'خراب', sortOrder: 1, minLevel: 5, maxLevel: 3 });
    expect(range.statusCode).toBe(400);
    expect(range.json()).toEqual({ error: 'level_range' });
  });

  it('puts a puzzle in a tier, shows it in the list, and unrates it when the tier is deleted', async () => {
    const { app, h } = boot();
    const made = await app.inject({ method: 'POST', url: '/admin/puzzles', headers: h, payload: { groups: groupsOf(ids) } });
    const puzzleId = made.json().id as string;
    const tiers = (await app.inject({ method: 'GET', url: '/admin/puzzles/tiers', headers: h })).json().tiers as { id: string }[];
    const tierId = tiers[1]!.id;
    expect((await app.inject({ method: 'PUT', url: `/admin/puzzles/${puzzleId}/tier`, headers: h, payload: { tierId } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/admin/puzzles', headers: h })).json().puzzles[0].tierId).toBe(tierId);
    expect((await app.inject({ method: 'PUT', url: `/admin/puzzles/${puzzleId}/tier`, headers: h, payload: { tierId: '00000000-0000-7000-a000-0000000000ff' } })).json()).toEqual({ error: 'unknown_tier' });
    await app.inject({ method: 'DELETE', url: `/admin/puzzles/tiers/${tierId}`, headers: h });
    expect((await app.inject({ method: 'GET', url: '/admin/puzzles', headers: h })).json().puzzles[0].tierId).toBeNull();
  });

  it('can create a puzzle straight into a tier', async () => {
    const { app, h } = boot();
    const tiers = (await app.inject({ method: 'GET', url: '/admin/puzzles/tiers', headers: h })).json().tiers as { id: string }[];
    await app.inject({ method: 'POST', url: '/admin/puzzles', headers: h, payload: { groups: groupsOf(ids), tierId: tiers[0]!.id } });
    expect((await app.inject({ method: 'GET', url: '/admin/puzzles', headers: h })).json().puzzles[0].tierId).toBe(tiers[0]!.id);
  });
});
