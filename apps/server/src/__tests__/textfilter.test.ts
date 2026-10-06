import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { createMemoryAuditLog } from '../admin/audit.js';
import { TextFilterService, createMemoryWordStore } from '../textfilter/service.js';

const TOKEN = 'secret-admin-token';
const h = { 'x-admin-token': TOKEN };

function setup() {
  const words = new TextFilterService(createMemoryWordStore(), () => Date.now());
  const audit = createMemoryAuditLog();
  const app = buildServer({
    admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: TOKEN },
    adminModules: { words, audit },
  });
  return { app, words, audit };
}

describe('text filter service', () => {
  it('rejects, masks and picks up list changes immediately', async () => {
    const { words } = setup();
    expect((await words.check('بدکلمه')).ok).toBe(true); // empty list rejects nothing
    await words.add('بدکلمه', 'block');
    expect((await words.check('تو بد‌کلمه‌ای')).ok).toBe(false);
    const [row] = await words.list();
    await words.setSeverity(row!.id, 'mask');
    expect(await words.check('این بدکلمه نیست')).toEqual({ ok: true, text: 'این ****** نیست' });
    await words.remove(row!.id);
    expect((await words.check('بدکلمه')).ok).toBe(true);
  });
});

describe('admin word routes', () => {
  it('adds, lists, tests, flips severity, removes and audits', async () => {
    const { app, audit } = setup();
    expect((await app.inject({ method: 'POST', url: '/admin/words', payload: { word: 'x' }, headers: h })).statusCode).toBe(400);
    const add = await app.inject({ method: 'POST', url: '/admin/words', payload: { word: 'بدکلمه' }, headers: h });
    expect(add.statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: '/admin/words', payload: { word: 'بدکلمه' }, headers: h })).statusCode).toBe(409);
    const id = add.json().id as string;
    expect((await app.inject({ method: 'GET', url: '/admin/words', headers: h })).json().words).toEqual([{ id, word: 'بدکلمه', severity: 'block', track: 'all' }]);
    const bad = await app.inject({ method: 'POST', url: '/admin/words/test', payload: { text: 'ب د ک ل م ه' }, headers: h });
    expect(bad.json()).toMatchObject({ ok: false, hit: { word: 'بدکلمه' } });
    expect((await app.inject({ method: 'PATCH', url: `/admin/words/${id}`, payload: { severity: 'mask' }, headers: h })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/admin/words/${id}`, headers: h })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/admin/words/${id}`, headers: h })).statusCode).toBe(404);
    await new Promise((r) => setTimeout(r, 5));
    expect(audit.entries.map((e) => e.action)).toEqual(expect.arrayContaining(['word.add', 'word.severity', 'word.remove']));
  });
  it('needs the admin token', async () => {
    expect((await setup().app.inject({ method: 'GET', url: '/admin/words' })).statusCode).toBe(401);
  });
});
