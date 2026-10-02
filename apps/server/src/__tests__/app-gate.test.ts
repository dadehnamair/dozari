import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { SettingsService } from '../settings/service.js';
import { createMemorySettingsStore } from '../settings/db-store.js';
import type { CatalogRepository } from '../catalog/routes.js';

const catalog: CatalogRepository = { listProducts: async () => [], getProduct: async () => null, listApprovedPrices: async () => [] };
const TOKEN = 'secret-admin-token-0123456789';

function boot() {
  const settings = new SettingsService(createMemorySettingsStore(), () => 0); // clock frozen: the 5 s cache is dropped by every write anyway
  const app = buildServer({ settings, catalog, admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: TOKEN } });
  return { app, settings };
}

describe('maintenance mode and feature flags', () => {
  it('is open by default and serves the client config', async () => {
    const { app } = boot();
    expect((await app.inject({ method: 'GET', url: '/products' })).statusCode).toBe(200);
    const cfg = (await app.inject({ method: 'GET', url: '/config' })).json().settings;
    expect(cfg['app.maintenance_on']).toBe(0);
    expect(cfg['feature.lookup']).toBe(1);
    expect(typeof cfg['app.maintenance_message']).toBe('string');
  });

  it('maintenance closes the player API but keeps health, config and admin reachable', async () => {
    const { app, settings } = boot();
    await settings.set('app.maintenance_on', '1');
    await settings.set('app.maintenance_message', 'تا ساعت ۸ برمی‌گردیم');
    const closed = await app.inject({ method: 'GET', url: '/products' });
    expect(closed.statusCode).toBe(503);
    expect(closed.json()).toEqual({ error: 'maintenance', message: 'تا ساعت ۸ برمی‌گردیم' });
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/config' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/admin/settings', headers: { 'x-admin-token': TOKEN } })).statusCode).not.toBe(503);
    await settings.set('app.maintenance_on', '0');
    expect((await app.inject({ method: 'GET', url: '/products' })).statusCode).toBe(200);
  });

  it('a switched-off feature answers 503 feature_off only on its own routes', async () => {
    const { app, settings } = boot();
    await settings.set('feature.lookup', '0');
    expect((await app.inject({ method: 'GET', url: '/lookup/search?q=x' })).json()).toEqual({ error: 'feature_off' });
    expect((await app.inject({ method: 'GET', url: '/products' })).statusCode).toBe(200);
  });
});
