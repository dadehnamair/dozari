import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { createMemoryAuditLog } from '../admin/audit.js';
import type { EconomyAdmin } from '../admin/economy.js';

const TOKEN = 'secret-admin-token';
const h = { 'x-admin-token': TOKEN };

describe('admin economy overview', () => {
  const asked: number[] = [];
  const economy: EconomyAdmin = {
    overview: async (days) => (
      asked.push(days),
      {
        days,
        circulation: { coins: 1200, holders: 3, top: [{ id: 'u1', nickname: 'علی', balance: 900 }] },
        flow: [{ reason: 'daily_login', faucet: 300, sink: 0, entries: 10 }],
        totals: { faucet: 300, sink: 0, net: 300 },
        daily: [{ day: '2026-10-05', faucet: 300, sink: 0 }],
        big: [],
      }
    ),
  };
  const app = buildServer({ admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: TOKEN }, adminModules: { audit: createMemoryAuditLog(), economy } });

  it('serves the numbers for a window, defaults to 7 days and clamps nonsense', async () => {
    expect((await app.inject({ method: 'GET', url: '/admin/economy', headers: h })).json()).toMatchObject({ days: 7, circulation: { coins: 1200 }, totals: { net: 300 } });
    await app.inject({ method: 'GET', url: '/admin/economy?days=30', headers: h });
    await app.inject({ method: 'GET', url: '/admin/economy?days=9999', headers: h });
    expect(asked).toEqual([7, 30, 7]);
  });

  it('needs the admin token', async () => {
    expect((await app.inject({ method: 'GET', url: '/admin/economy' })).statusCode).toBe(401);
  });
});
