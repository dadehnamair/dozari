import { describe, expect, it } from 'vitest';
import { defaultLevelTable, levelInfo } from '@dozari/shared';
import { buildServer } from '../index.js';
import { createMemoryAuditLog } from '../admin/audit.js';
import { LevelTable, createMemoryLevelTableStore } from '../progress/table.js';
import { LevelRoadService } from '../progress/road.js';
import { rulesFromSettings } from '../player/service.js';
import type { SettingsService } from '../settings/service.js';

const TOKEN = 'secret-admin-token';
const defaults = async () => defaultLevelTable({ curveBase: 50, levelMax: 6 }, { every: 5, base: 25 });

function boot() {
  const table = new LevelTable(createMemoryLevelTableStore(), 0);
  const app = buildServer({
    admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: TOKEN },
    adminModules: { audit: createMemoryAuditLog(), levelRoad: { table, defaults } },
  });
  return { app, table, h: { 'x-admin-token': TOKEN } };
}
const rows = [{ level: 1, startXp: 0, rewardCoins: 0 }, { level: 2, startXp: 40, rewardCoins: 100 }, { level: 3, startXp: 120, rewardCoins: 0 }];

describe('level table in the admin panel', () => {
  it('shows the formula until a table is saved, then the saved one, and can go back', async () => {
    const { app, h, table } = boot();
    const first = (await app.inject({ method: 'GET', url: '/admin/level-road', headers: h })).json();
    expect(first.custom).toBe(false);
    expect(first.rows).toHaveLength(6);
    const saved = await app.inject({ method: 'PUT', url: '/admin/level-road', headers: h, payload: { rows } });
    expect(saved.statusCode).toBe(200);
    expect((await table.get())?.map((r) => r.startXp)).toEqual([0, 40, 120]);
    expect((await app.inject({ method: 'GET', url: '/admin/level-road', headers: h })).json()).toMatchObject({ custom: true, rows });
    expect((await app.inject({ method: 'GET', url: '/admin/level-road?defaults=1', headers: h })).json()).toMatchObject({ custom: true });
    const back = (await app.inject({ method: 'DELETE', url: '/admin/level-road', headers: h })).json();
    expect(back.custom).toBe(false);
    expect(await table.get()).toBeNull();
  });

  it('refuses a broken table and asks for the admin token', async () => {
    const { app, h } = boot();
    const bad = await app.inject({ method: 'PUT', url: '/admin/level-road', headers: h, payload: { rows: [rows[0], { level: 2, startXp: 0, rewardCoins: 5 }] } });
    expect([bad.statusCode, bad.json().error]).toEqual([400, 'not_increasing']);
    expect((await app.inject({ method: 'PUT', url: '/admin/level-road', payload: { rows } })).statusCode).toBe(401);
  });
});

describe('the table drives levels and rewards', () => {
  const settings = { num: async (k: string) => ({ 'xp.solo_base': 5, 'xp.duel_base': 10, 'xp.win_bonus': 15, 'xp.curve_base': 50, 'xp.level_max': 50 })[k] ?? 1 } as unknown as SettingsService;

  it('rules take the level cap and the starts from the table', async () => {
    const table = new LevelTable(createMemoryLevelTableStore(rows), 0);
    const rules = await rulesFromSettings(settings, () => table.get());
    expect(rules.xp.levelMax).toBe(3);
    expect(levelInfo(45, rules.xp).level).toBe(2);
    expect((await rulesFromSettings(settings)).xp.levelMax).toBe(50);
  });

  it('the road pays the table coins, not the formula, and reports every start XP', async () => {
    const table = new LevelTable(createMemoryLevelTableStore(rows), 0);
    const rules = (await rulesFromSettings(settings, () => table.get())).xp;
    const road = await new LevelRoadService({
      levelOf: async () => levelInfo(130, rules),
      xpRules: async () => rules,
      table: () => table.get(),
      rewardRules: async () => ({ every: 5, base: 25 }),
      claimedLevels: async () => [],
      payRewards: async (_u, rs) => ({ paid: rs, balance: 1 }),
      gates: async () => ({}),
      shopItems: async () => [],
    }).road('u');
    expect(road.rewards).toEqual([{ level: 2, coins: 100, spins: 0, claimed: false }]);
    expect(road).toMatchObject({ levelMax: 3, starts: [0, 40, 120], level: 3 });
  });

  it('a spins-only level is on the road, and claiming reports the spins', async () => {
    const withSpins = [{ level: 1, startXp: 0, rewardCoins: 0, rewardSpins: 0 }, { level: 2, startXp: 40, rewardCoins: 0, rewardSpins: 2 }, { level: 3, startXp: 120, rewardCoins: 30, rewardSpins: 1 }];
    const table = new LevelTable(createMemoryLevelTableStore(withSpins), 0);
    const rules = (await rulesFromSettings(settings, () => table.get())).xp;
    const service = new LevelRoadService({
      levelOf: async () => levelInfo(130, rules),
      xpRules: async () => rules,
      table: () => table.get(),
      rewardRules: async () => ({ every: 0, base: 0 }),
      claimedLevels: async () => [],
      payRewards: async (_u, rs) => ({ paid: rs, balance: 1 }),
      gates: async () => ({}),
      shopItems: async () => [],
    });
    expect((await service.road('u')).rewards).toEqual([{ level: 2, coins: 0, spins: 2, claimed: false }, { level: 3, coins: 30, spins: 1, claimed: false }]);
    expect(await service.claim('u')).toMatchObject({ levels: [2, 3], coins: 30, spins: 3 });
  });
});
