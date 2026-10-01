import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { SettingsService } from '../settings/service.js';
import { createMemorySettingsStore } from '../settings/db-store.js';
import { createMemoryAuditLog } from '../admin/audit.js';
import type { ProductAdmin } from '../admin/products.js';
import type { UsersAdmin } from '../admin/users.js';
import type { BotRepository } from '../bot/repository.js';
import { BotService } from '../bot/service.js';

const TOKEN = 'secret-admin-token';
const h = { 'x-admin-token': TOKEN };
const ID = '0190a000-0000-7000-8000-000000000001';

function setup() {
  const settings = new SettingsService(createMemorySettingsStore());
  const audit = createMemoryAuditLog();
  const calls: unknown[][] = [];
  const products: ProductAdmin = {
    details: async () => ({ [ID]: { category: 'food', iconKey: 'bread', isActive: true, brand: null, storyFa: null, status: 'in_production' } }),
    update: async (id, patch) => {
      calls.push(['update', id, patch]);
      return patch.iconKey === 'nope' ? 'invalid' : 'ok';
    },
    create: async (input) => (input.slug === 'taken' ? 'duplicate' : { id: ID }),
    addPrice: async () => ({ id: ID }),
  };
  const users: UsersAdmin = {
    list: async () => [],
    detail: async () => null,
    ledger: async () => [],
    setBanned: async () => 'ok',
    logoutEverywhere: async () => 'ok',
    setIdentity: async () => 'ok',
    addNote: async () => ({ id: ID }),
    removeNote: async () => 'ok',
    adjustCoins: async (_id, delta) => (delta < -50 ? 'insufficient' : { balance: 100 + delta }),
  };
  const botRepo = { listSources: async () => [], listCandidates: async () => [], listRuns: async () => [], approve: async () => 'conflict', reject: async () => 'ok' } as unknown as BotRepository;
  const app = buildServer({
    settings,
    admin: { repo: { listCatalog: async () => [{ id: ID, slug: 'bread', nameFa: 'نان', unitFa: null, prices: [] }], setPriceStatus: async () => 'ok' }, token: TOKEN },
    adminModules: { products, users, audit, bot: { repo: botRepo, service: new BotService(botRepo) } },
  });
  return { app, audit, calls };
}

describe('admin modules', () => {
  it('guards every new route with the token', async () => {
    const { app } = setup();
    for (const [method, url] of [['GET', '/admin/meta'], ['GET', '/admin/settings'], ['PUT', '/admin/settings/game.turn_seconds'], ['GET', '/admin/users'], ['GET', '/admin/bot/candidates']] as const) {
      expect((await app.inject({ method, url })).statusCode, url).toBe(401);
    }
  });

  it('lists meta with the icon pack and the modules that are on', async () => {
    const { app } = setup();
    const meta = (await app.inject({ method: 'GET', url: '/admin/meta', headers: h })).json() as { icons: Record<string, unknown>; categories: string[]; modules: Record<string, boolean> };
    expect(Object.keys(meta.icons)).toContain('chest');
    expect(meta.categories).toContain('food');
    expect(meta.modules).toMatchObject({ settings: true, products: true, bot: true, stats: false });
  });

  it('edits settings, validates them, serves them to clients and records the change', async () => {
    const { app, audit } = setup();
    expect((await app.inject({ method: 'PUT', url: '/admin/settings/game.turn_seconds', headers: h, payload: { value: 5 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: '/admin/settings/nope', headers: h, payload: { value: 5 } })).statusCode).toBe(404);
    const ok = await app.inject({ method: 'PUT', url: '/admin/settings/game.turn_seconds', headers: h, payload: { value: 60 } });
    expect(ok.statusCode).toBe(200);
    const row = (ok.json() as { settings: { key: string; value: number; overridden: boolean }[] }).settings.find((s) => s.key === 'game.turn_seconds');
    expect(row).toMatchObject({ value: 60, overridden: true });
    const pub = (await app.inject({ method: 'GET', url: '/config' })).json() as { settings: Record<string, unknown> };
    expect(pub.settings['game.turn_seconds']).toBe(60);
    expect(Object.keys(pub.settings).some((k) => k.startsWith('bot.'))).toBe(false);
    await app.inject({ method: 'DELETE', url: '/admin/settings/game.turn_seconds', headers: h });
    expect(((await app.inject({ method: 'GET', url: '/config' })).json() as { settings: Record<string, unknown> }).settings['game.turn_seconds']).toBe(45);
    expect(audit.entries.map((e) => e.action)).toEqual(['settings.reset', 'settings.set']);
  });

  it('merges product details into the catalog and edits a product icon', async () => {
    const { app, calls, audit } = setup();
    const cat = (await app.inject({ method: 'GET', url: '/admin/catalog', headers: h })).json() as { products: { iconKey: string; category: string }[] };
    expect(cat.products[0]).toMatchObject({ iconKey: 'bread', category: 'food' });
    expect((await app.inject({ method: 'PATCH', url: `/admin/products/${ID}`, headers: h, payload: { iconKey: 'chest' } })).statusCode).toBe(200);
    expect(calls[0]).toEqual(['update', ID, { iconKey: 'chest' }]);
    expect((await app.inject({ method: 'PATCH', url: `/admin/products/${ID}`, headers: h, payload: { iconKey: 'nope' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: `/admin/products/${ID}`, headers: h, payload: { slug: 'x' } })).statusCode).toBe(400);
    expect(audit.entries[0]?.action).toBe('product.update');
  });

  it('creates products, rejects duplicates and bad categories, adds a hand-typed pending price', async () => {
    const { app } = setup();
    expect((await app.inject({ method: 'POST', url: '/admin/products', headers: h, payload: { slug: 'milk', nameFa: 'شیر', category: 'food' } })).statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: '/admin/products', headers: h, payload: { slug: 'taken', nameFa: 'شیر', category: 'food' } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'POST', url: '/admin/products', headers: h, payload: { slug: 'x1', nameFa: 'شیر', category: 'spaceship' } })).statusCode).toBe(400);
    const price = { productId: ID, year: 1375, priceRials: '500', sourceType: 'archive_newspaper' };
    expect((await app.inject({ method: 'POST', url: '/admin/prices', headers: h, payload: price })).statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: '/admin/prices', headers: h, payload: { ...price, year: 2020 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/admin/prices', headers: h, payload: { ...price, priceRials: '12.5' } })).statusCode).toBe(400);
  });

  it('adjusts coins through the ledger service and refuses an overdraft', async () => {
    const { app } = setup();
    const url = `/admin/users/${ID}/coins`;
    expect((await app.inject({ method: 'POST', url, headers: h, payload: { delta: 25 } })).json()).toEqual({ ok: true, balance: 125 });
    expect((await app.inject({ method: 'POST', url, headers: h, payload: { delta: -100 } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'POST', url, headers: h, payload: { delta: 0 } })).statusCode).toBe(400);
  });

  it('manages a player: detail, ban with reason, log out everywhere, identity, notes', async () => {
    const calls: unknown[][] = [];
    const settings = new SettingsService(createMemorySettingsStore());
    const audit = createMemoryAuditLog();
    const users: UsersAdmin = {
      list: async (q, limit, opts) => (calls.push(['list', q, limit, opts]), []),
      detail: async (id) => (id === ID ? { id, nickname: 'n', avatarKey: 'avatar-01', isBanned: false, balance: 5, createdAt: 1, lastSeenAt: 2, gender: 'female', banReason: null, bannedAt: null, friends: 2, baleLinked: true, notes: [] } : null),
      ledger: async () => [],
      setBanned: async (id, banned, reason) => (calls.push(['ban', id, banned, reason]), 'ok'),
      logoutEverywhere: async (id) => (calls.push(['logout', id]), 'ok'),
      setIdentity: async (id, identity) => (calls.push(['identity', id, identity]), identity?.avatarKey === 'bad' ? 'invalid' : 'ok'),
      addNote: async (id, note) => (calls.push(['note', id, note]), { id: ID }),
      removeNote: async () => 'ok',
      adjustCoins: async () => ({ balance: 1 }),
    };
    const app = buildServer({ settings, admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: TOKEN }, adminModules: { users, audit } });
    expect((await app.inject({ method: 'GET', url: `/admin/users/${ID}`, headers: h })).json()).toMatchObject({ friends: 2, baleLinked: true, gender: 'female' });
    expect((await app.inject({ method: 'GET', url: '/admin/users/0190a000-0000-7000-8000-0000000000ff', headers: h })).statusCode).toBe(404);
    await app.inject({ method: 'GET', url: '/admin/users?q=ali&filter=banned&sort=coins&offset=50', headers: h });
    expect(calls[0]).toEqual(['list', 'ali', 50, { filter: 'banned', sort: 'coins', offset: 50 }]);
    expect((await app.inject({ method: 'GET', url: '/admin/users?filter=weird', headers: h })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: `/admin/users/${ID}/ban`, headers: h, payload: { banned: true, reason: 'اسم نامناسب' } })).statusCode).toBe(200);
    expect(calls.at(-1)).toEqual(['ban', ID, true, 'اسم نامناسب']);
    expect((await app.inject({ method: 'POST', url: `/admin/users/${ID}/logout`, headers: h })).json()).toEqual({ ok: true });
    expect((await app.inject({ method: 'PUT', url: `/admin/users/${ID}/identity`, headers: h, payload: {} })).statusCode).toBe(200); // random reset
    expect(calls.at(-1)).toEqual(['identity', ID, undefined]);
    expect((await app.inject({ method: 'PUT', url: `/admin/users/${ID}/identity`, headers: h, payload: { nickname: 'خوب' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PUT', url: `/admin/users/${ID}/identity`, headers: h, payload: { avatarKey: 'bad' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: `/admin/users/${ID}/notes`, headers: h, payload: { note: 'هشدار اول' } })).statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: `/admin/users/${ID}/notes`, headers: h, payload: { note: '' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'DELETE', url: `/admin/user-notes/${ID}`, headers: h })).statusCode).toBe(200);
    expect(audit.entries.map((e) => e.action)).toEqual(expect.arrayContaining(['user.ban', 'user.logout', 'user.identity_reset', 'user.identity', 'user.note', 'user.note_delete']));
  });

  it('answers the candidate decisions with the right status codes', async () => {
    const { app } = setup();
    expect((await app.inject({ method: 'POST', url: `/admin/bot/candidates/${ID}/approve`, headers: h, payload: {} })).statusCode).toBe(409);
    expect((await app.inject({ method: 'POST', url: `/admin/bot/candidates/${ID}/reject`, headers: h })).statusCode).toBe(200);
  });
});
