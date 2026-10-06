import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { SettingsService } from '../settings/service.js';
import { createMemorySettingsStore } from '../settings/db-store.js';
import { createMemoryAuditLog } from '../admin/audit.js';
import { createMemoryPlayerStore } from '../player/store.js';

const TOKEN = 'secret-admin-token';
const h = { 'x-admin-token': TOKEN };
const U1 = '0190a000-0000-7000-8000-0000000000a1';
const U2 = '0190a000-0000-7000-8000-0000000000a2';

describe('admin cities', () => {
  it('shows per-city stats and players, and moves a player out of a city', async () => {
    const players = createMemoryPlayerStore();
    const [a, b] = await players.cities();
    await players.setCity(U1, a!.id);
    await players.setCity(U2, a!.id);
    await players.setNickname(U1, 'علی');
    await players.addGame(U1, 'win', 40);
    const app = buildServer({
      settings: new SettingsService(createMemorySettingsStore()),
      admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: TOKEN },
      adminModules: { audit: createMemoryAuditLog(), cities: players },
    });
    const list = (await app.inject({ method: 'GET', url: '/admin/cities', headers: h })).json() as { cities: { id: string; stats: { players: number; xp: number } }[] };
    expect(list.cities.find((c) => c.id === a!.id)!.stats).toMatchObject({ players: 2, xp: 40 });
    expect(list.cities.find((c) => c.id === b!.id)!.stats.players).toBe(0);

    const ps = (await app.inject({ method: 'GET', url: `/admin/cities/${a!.id}/players`, headers: h })).json() as { players: { id: string }[] };
    expect(ps.players.map((p) => p.id)).toEqual([U1, U2]); // strongest first

    const mv = await app.inject({ method: 'PUT', url: `/admin/cities/${a!.id}/players/${U2}`, headers: h, payload: { cityId: b!.id } });
    expect(mv.statusCode).toBe(200);
    expect((await players.privateRow(U2)).cityId).toBe(b!.id);
    // a player who is not in that city can't be moved from it
    expect((await app.inject({ method: 'PUT', url: `/admin/cities/${a!.id}/players/${U2}`, headers: h, payload: { cityId: null } })).statusCode).toBe(404);
  });
});
