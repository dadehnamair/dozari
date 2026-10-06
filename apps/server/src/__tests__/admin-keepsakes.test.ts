import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { createMemoryAuditLog } from '../admin/audit.js';
import { createMemoryKeepsakeStore } from '../keepsakes/memory.js';

const TOKEN = 'secret-admin-token';
const h = { 'x-admin-token': TOKEN };

describe('admin keepsakes', () => {
  const store = createMemoryKeepsakeStore();
  const app = buildServer({ admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: TOKEN }, adminModules: { audit: createMemoryAuditLog(), keepsakes: store } });
  const body = { titleFa: 'پفک نمکی', storyFa: 'بوی پفک بعد از مدرسه', rarity: 'rare', pieces: 4, eraYear: 1370 };

  it('needs the admin token', async () => {
    expect((await app.inject({ method: 'GET', url: '/admin/keepsakes' })).statusCode).toBe(401);
  });
  it('creates a set and a keepsake, edits the art key, and hides it', async () => {
    const set = (await app.inject({ method: 'POST', url: '/admin/keepsake-sets', headers: h, payload: { titleFa: 'دهه‌ی هفتاد', rewardGems: 12 } })).json() as { id: string };
    const made = await app.inject({ method: 'POST', url: '/admin/keepsakes', headers: h, payload: { ...body, setId: set.id } });
    expect(made.statusCode).toBe(201);
    const id = (made.json() as { id: string }).id;
    expect((await app.inject({ method: 'PATCH', url: `/admin/keepsakes/${id}`, headers: h, payload: { artKey: 'puffak_v1' } })).json()).toEqual({ ok: true });
    const list = (await app.inject({ method: 'GET', url: '/admin/keepsakes', headers: h })).json() as { defs: { id: string; artKey: string | null; rewardGems: number; isActive: boolean }[]; sets: { rewardGems: number }[] };
    expect(list.defs[0]).toMatchObject({ id, artKey: 'puffak_v1', rewardGems: 3 });
    expect(list.sets[0]).toMatchObject({ rewardGems: 12 });
    await app.inject({ method: 'PATCH', url: `/admin/keepsakes/${id}`, headers: h, payload: { isActive: false } });
    expect(((await app.inject({ method: 'GET', url: '/admin/keepsakes', headers: h })).json() as { defs: { isActive: boolean }[] }).defs[0]!.isActive).toBe(false);
    expect((await store.defs()).length).toBe(0); // players no longer see it
  });
  it('rejects a keepsake with a missing story, a bad rarity or too many pieces', async () => {
    for (const bad of [{ ...body, storyFa: '' }, { ...body, rarity: 'mythic' }, { ...body, pieces: 99 }]) {
      expect((await app.inject({ method: 'POST', url: '/admin/keepsakes', headers: h, payload: bad })).statusCode).toBe(400);
    }
  });
  it('answers 404 for an unknown keepsake', async () => {
    expect((await app.inject({ method: 'PATCH', url: '/admin/keepsakes/00000000-0000-7000-8000-0000000000ff', headers: h, payload: { titleFa: 'xx' } })).statusCode).toBe(404);
  });
});
