import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import type { CatalogRepository } from '../catalog/routes.js';

const ID = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const repo: CatalogRepository = {
  listProducts: async () => [
    {
      id: ID,
      slug: 'peykan-javanan',
      nameFa: 'پیکان جوانان',
      brand: null,
      category: 'car',
      unitFa: null,
      audience: [],
      eraTags: [],
      storyFa: null,
      status: 'discontinued',
      iconKey: null,
    },
  ],
  getProduct: async (id) =>
    id === ID
      ? {
          id,
          slug: 'peykan-javanan',
          nameFa: 'پیکان جوانان',
          brand: null,
          category: 'car',
          unitFa: null,
          audience: [],
          eraTags: [],
          storyFa: null,
          status: 'discontinued',
          iconKey: null,
        }
      : null,
  listApprovedPrices: async () => [
    { year: 1357, month: null, priceRials: '300000', sourceType: 'other', confidence: 2 },
  ],
};

describe('catalog routes', () => {
  const app = buildServer({ catalog: repo });

  it('lists products', async () => {
    const res = await app.inject({ method: 'GET', url: '/products' });
    expect(res.statusCode).toBe(200);
    expect(res.json().products).toHaveLength(1);
  });

  it('returns a product', async () => {
    const res = await app.inject({ method: 'GET', url: `/products/${ID}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().slug).toBe('peykan-javanan');
  });

  it('returns approved prices with rials as strings', async () => {
    const res = await app.inject({ method: 'GET', url: `/products/${ID}/prices` });
    expect(res.statusCode).toBe(200);
    expect(res.json().prices[0].priceRials).toBe('300000');
  });

  it('400 on bad id, 404 on unknown product', async () => {
    expect((await app.inject({ method: 'GET', url: '/products/nope' })).statusCode).toBe(400);
    const missing = '0190a1b2-c3d4-7e5f-8a9b-000000000000';
    expect((await app.inject({ method: 'GET', url: `/products/${missing}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/products/${missing}/prices` })).statusCode).toBe(404);
  });
});

describe('price lookup routes', () => {
  const app = buildServer({ catalog: repo });

  it('finds a product by name with its approved range', async () => {
    const { lookupSearchSchema } = await import('@dozari/shared');
    const res = await app.inject({ method: 'GET', url: `/lookup/search?q=${encodeURIComponent('پیكان')}` }); // Arabic kaf still matches
    expect(res.statusCode).toBe(200);
    const body = lookupSearchSchema.parse(res.json());
    expect(body.results).toHaveLength(1);
    expect(body.results[0]!.range).toMatchObject({ count: 1, first: { year: 1357 }, max: { priceRials: '300000' } });
    expect((await app.inject({ method: 'GET', url: `/lookup/search?q=${encodeURIComponent('نان')}` })).json().results).toEqual([]);
    expect((await app.inject({ method: 'GET', url: '/lookup/search' })).statusCode).toBe(400);
  });

  it('answers for a year only from approved data, never an estimate', async () => {
    const { lookupDetailSchema } = await import('@dozari/shared');
    const hit = lookupDetailSchema.parse((await app.inject({ method: 'GET', url: `/lookup/${ID}?year=1357` })).json());
    expect(hit.at).toEqual({ year: 1357, month: null, priceRials: '300000' });
    const gap = lookupDetailSchema.parse((await app.inject({ method: 'GET', url: `/lookup/${ID}?year=1360` })).json());
    expect(gap.at).toBeNull();
    expect(gap.points).toHaveLength(1);
    expect((await app.inject({ method: 'GET', url: '/lookup/nope' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/lookup/0190a1b2-c3d4-7e5f-8a9b-000000000000' })).statusCode).toBe(404);
  });
});
