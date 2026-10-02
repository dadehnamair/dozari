import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { createMemoryAuditLog } from '../admin/audit.js';
import { checkShape, createMemoryPuzzleAdmin } from '../puzzles/admin.js';

const TOKEN = 'secret-admin-token';
const ids = Array.from({ length: 16 }, (_, i) => `00000000-0000-7000-8000-${String(i + 1).padStart(12, '0')}`);
const groupsOf = (list: string[]) => [0, 1, 2, 3].map((level) => ({ level, titleFa: `دسته‌ی ${level + 1}`, explanationFa: 'همه‌شان یک چیز بودند', productIds: list.slice(level * 4, level * 4 + 4) }));

function boot() {
  const puzzles = createMemoryPuzzleAdmin(new Set(ids));
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
});
