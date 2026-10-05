import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { createMemoryAuditLog } from '../admin/audit.js';
import { SettingsService } from '../settings/service.js';
import { createMemorySettingsStore } from '../settings/db-store.js';
import type { LessonStore } from '../lessons/service.js';
import type { AgeTrackAdmin } from '../agetrack/overview.js';

const TOKEN = 'secret-admin-token';
const h = { 'x-admin-token': TOKEN };

function setup() {
  const calls: unknown[][] = [];
  const lessons: LessonStore = {
    approvedFor: async () => [],
    listKidItems: async (status) => (calls.push(['list', status]), [{ productId: 'p1', nameFa: 'سیب', iconKey: 'apple', lesson: null }]),
    save: async (id, input) => (calls.push(['save', id, input]), id !== 'missing'),
    setStatus: async (id, status) => (calls.push(['status', id, status]), id === 'missing' ? 'not_found' : 'ok'),
  };
  const ageTracks: AgeTrackAdmin = {
    overview: async () => ({ players: { kid: 1, teen: 2, adult: 3 }, puzzles: { kid: { draft: 3, approved: 0, retired: 0 }, teen: { draft: 0, approved: 0, retired: 0 }, adult: { draft: 0, approved: 5, retired: 1 } }, kidItems: { total: 48, missing: 40, draft: 8, approved: 0 }, linkedChildren: 2 }),
  };
  const app = buildServer({
    settings: new SettingsService(createMemorySettingsStore()),
    admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: TOKEN },
    adminModules: { audit: createMemoryAuditLog(), lessons, ageTracks },
  });
  return { app, calls };
}


describe('admin lessons and age-track overview', () => {
  it('lists kid items, saves a lesson as text, approves and sends back to draft', async () => {
    const { app, calls } = setup();
    expect((await app.inject({ method: 'GET', url: '/admin/lessons?status=missing', headers: h })).json()).toMatchObject({ items: [{ productId: 'p1' }] });
    expect(calls[0]).toEqual(['list', 'missing']);
    const put = await app.inject({ method: 'PUT', url: '/admin/lessons/p1', headers: h, payload: { wordFa: ' سیب ', storyFa: 'میوه', syllablesFa: '' } });
    expect(put.json()).toEqual({ ok: true });
    expect(calls[1]).toEqual(['save', 'p1', { wordFa: 'سیب', storyFa: 'میوه', syllablesFa: null }]);
    expect((await app.inject({ method: 'POST', url: '/admin/lessons/p1/approve', headers: h, payload: {} })).json()).toEqual({ ok: true });
    expect(calls[2]).toEqual(['status', 'p1', 'approved']);
    await app.inject({ method: 'POST', url: '/admin/lessons/p1/unapprove', headers: h, payload: {} });
    expect(calls[3]).toEqual(['status', 'p1', 'draft']);
  });

  it('answers 404 for an unknown item and 400 for an empty word, and needs the admin token', async () => {
    const { app } = setup();
    expect((await app.inject({ method: 'PUT', url: '/admin/lessons/missing', headers: h, payload: { wordFa: 'x' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/admin/lessons/missing/approve', headers: h, payload: {} })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PUT', url: '/admin/lessons/p1', headers: h, payload: { wordFa: '' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/admin/lessons' })).statusCode).toBe(401);
  });

  it('serves the overview numbers', async () => {
    const { app } = setup();
    expect((await app.inject({ method: 'GET', url: '/admin/age-tracks', headers: h })).json()).toMatchObject({ players: { kid: 1, teen: 2, adult: 3 }, kidItems: { total: 48 }, linkedChildren: 2 });
  });
});
