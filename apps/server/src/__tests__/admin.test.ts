import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import type { AdminRepository, SetStatusResult } from '../admin/routes.js';

const PRICE = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const TOKEN = 'secret-token';

function makeRepo(result: SetStatusResult = 'ok') {
  const calls: [string, string][] = [];
  const repo: AdminRepository = {
    listCatalog: async () => [
      {
        id: 'p1',
        slug: 'peykan-javanan',
        nameFa: 'پیکان جوانان',
        unitFa: 'یک دستگاه',
        prices: [
          {
            id: PRICE,
            year: 1357,
            month: null,
            priceRials: '300000',
            sourceType: 'other',
            sourceUrl: null,
            sourceNote: null,
            confidence: 1,
            status: 'pending',
          },
        ],
      },
    ],
    setPriceStatus: async (id, status) => {
      calls.push([id, status]);
      return result;
    },
  };
  return { repo, calls };
}

const auth = { 'x-admin-token': TOKEN };

describe('admin routes', () => {
  it('is not registered without an admin dependency', async () => {
    const res = await buildServer().inject({ method: 'GET', url: '/admin' });
    expect(res.statusCode).toBe(404);
  });

  it('serves the page without a token but guards the data', async () => {
    const app = buildServer({ admin: { repo: makeRepo().repo, token: TOKEN } });
    const page = await app.inject({ method: 'GET', url: '/admin' });
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect((await app.inject({ method: 'GET', url: '/admin/catalog' })).statusCode).toBe(401);
    const wrong = await app.inject({ method: 'GET', url: '/admin/catalog', headers: { 'x-admin-token': 'nope' } });
    expect(wrong.statusCode).toBe(401);
  });

  it('lists the catalog with a valid token', async () => {
    const app = buildServer({ admin: { repo: makeRepo().repo, token: TOKEN } });
    const res = await app.inject({ method: 'GET', url: '/admin/catalog', headers: auth });
    expect(res.statusCode).toBe(200);
    expect(res.json().products[0].prices[0].priceRials).toBe('300000');
  });

  it('summarises the approved price range and flags products with too few points', async () => {
    const pt = (id: string, year: number, month: number | null, priceRials: string, status: 'approved' | 'pending') => ({ id, year, month, priceRials, sourceType: 'other', sourceUrl: null, sourceNote: null, confidence: 1, status });
    const repo: AdminRepository = {
      listCatalog: async () => [
        { id: 'a', slug: 'a', nameFa: 'الف', unitFa: null, prices: [pt('1', 1375, 6, '1000', 'approved'), pt('2', 1390, null, '40000', 'approved'), pt('3', 1380, 1, '5000', 'approved'), pt('4', 1300, null, '1', 'pending')] },
        { id: 'b', slug: 'b', nameFa: 'ب', unitFa: null, prices: [pt('5', 1375, null, '9', 'pending')] },
      ],
      setPriceStatus: async () => 'ok',
    };
    const res = await buildServer({ admin: { repo, token: TOKEN } }).inject({ method: 'GET', url: '/admin/catalog', headers: auth });
    const [a, b] = res.json().products;
    expect(a.needsMorePrices).toBe(false);
    expect(a.range).toMatchObject({ count: 3, first: { year: 1375, month: 6 }, last: { year: 1390, month: null }, min: { priceRials: '1000' }, max: { priceRials: '40000' } });
    expect(b.range).toBeNull();
    expect(b.needsMorePrices).toBe(true);
  });

  it('changes a price status', async () => {
    const { repo, calls } = makeRepo();
    const app = buildServer({ admin: { repo, token: TOKEN } });
    const res = await app.inject({
      method: 'PATCH',
      url: `/admin/prices/${PRICE}`,
      headers: auth,
      payload: { status: 'approved' },
    });
    expect(res.statusCode).toBe(200);
    expect(calls).toEqual([[PRICE, 'approved']]);
  });

  it('requires the token for changes and validates input', async () => {
    const { repo, calls } = makeRepo();
    const app = buildServer({ admin: { repo, token: TOKEN } });
    const noAuth = await app.inject({ method: 'PATCH', url: `/admin/prices/${PRICE}`, payload: { status: 'approved' } });
    expect(noAuth.statusCode).toBe(401);
    const badStatus = await app.inject({ method: 'PATCH', url: `/admin/prices/${PRICE}`, headers: auth, payload: { status: 'nope' } });
    expect(badStatus.statusCode).toBe(400);
    const badId = await app.inject({ method: 'PATCH', url: '/admin/prices/x', headers: auth, payload: { status: 'approved' } });
    expect(badId.statusCode).toBe(400);
    expect(calls).toEqual([]);
  });

  it('maps repository results to 404 and 409', async () => {
    const send = (r: SetStatusResult) =>
      buildServer({ admin: { repo: makeRepo(r).repo, token: TOKEN } }).inject({
        method: 'PATCH',
        url: `/admin/prices/${PRICE}`,
        headers: auth,
        payload: { status: 'approved' },
      });
    expect((await send('not_found')).statusCode).toBe(404);
    expect((await send('conflict')).statusCode).toBe(409);
  });
});
