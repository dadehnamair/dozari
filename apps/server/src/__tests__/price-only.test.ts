import { describe, expect, it } from 'vitest';
import { priceOnlyViewSchema } from '@dozari/shared';
import type { CatalogProduct } from '@dozari/shared';
import { buildServer } from '../index.js';
import { PriceOnlyService } from '../priceonly/service.js';
import type { PriceOnlySource } from '../priceonly/service.js';

const product = (i: number): CatalogProduct => ({
  id: `p${i}`,
  category: 'food',
  eraTags: [],
  prices: [1370, 1380, 1390].map((year, k) => ({ year, month: null, priceRials: BigInt(((k + 1) * 1000 + i) * 10) })),
});
const catalog = Array.from({ length: 20 }, (_, i) => product(i));
const items = Object.fromEntries(catalog.map((p) => [p.id, { nameFa: `کالا ${p.id}`, unitFa: null, iconKey: null }]));
const source: PriceOnlySource = { products: async (limit) => ({ catalog: catalog.slice(0, limit), items }) };
const rules = async () => ({ rounds: 5, tiers: [{ maxErrorPct: 5, points: 5 }, { maxErrorPct: 15, points: 4 }, { maxErrorPct: 30, points: 3 }, { maxErrorPct: 60, points: 2 }], minPoints: 1 });

function setup() {
  const priceOnly = new PriceOnlyService(source, { newSeed: () => 7, rules });
  return { priceOnly, app: buildServer({ priceOnly }) };
}

describe('PriceOnlyService', () => {
  it('asks the configured number of distinct products and shows no real price before an answer', async () => {
    const { priceOnly } = setup();
    const view = (await priceOnly.start())!;
    expect(view.rounds).toHaveLength(5);
    expect(new Set(view.rounds.map((r) => r.productId)).size).toBe(5);
    expect(view.results).toEqual([]);
    expect(view.done).toBe(false);
    expect(view.maxPoints).toBe(25);
    expect(JSON.stringify(view)).not.toMatch(/actualRials/);
  });

  it('scores a guess on the staircase, reveals only that round, and ends after the last one', async () => {
    const { priceOnly } = setup();
    const view = (await priceOnly.start('user-1'))!;
    const first = priceOnly.guess(view.sessionId, 0, 10n);
    if (typeof first === 'string' || first === null) throw new Error('expected a result');
    expect(first.result.points).toBe(1); // wildly off
    expect(first.view.results).toHaveLength(1);
    expect(BigInt(first.result.actualRials)).toBeGreaterThan(0n);
    for (let i = 1; i < 5; i++) {
      const round = view.rounds[i]!;
      const actual = BigInt(catalog.find((p) => p.id === round.productId)!.prices.find((p) => p.year === round.year)!.priceRials);
      const out = priceOnly.guess(view.sessionId, i, actual);
      if (typeof out === 'string' || out === null) throw new Error('expected a result');
      expect(out.result.points).toBe(5);
    }
    expect(priceOnly.view(view.sessionId)).toMatchObject({ done: true });
  });

  it('answering a round twice keeps the first result', async () => {
    const { priceOnly } = setup();
    const view = (await priceOnly.start())!;
    const a = priceOnly.guess(view.sessionId, 2, 1n);
    const b = priceOnly.guess(view.sessionId, 2, 999999999n);
    expect(typeof a === 'object' && a && b && typeof b === 'object' && b.result).toEqual(typeof a === 'object' && a && a.result);
  });

  it('has nothing to ask on an empty catalog', async () => {
    const empty = new PriceOnlyService({ products: async () => ({ catalog: [], items: {} }) }, { rules });
    expect(await empty.start()).toBeNull();
  });

  it('calls onFinished once, with the total, when the last round is answered', async () => {
    const done: [string, number][] = [];
    const svc = new PriceOnlyService(source, { newSeed: () => 7, rules, onFinished: (u, p) => done.push([u, p]) });
    const view = (await svc.start('u1'))!;
    for (let i = 0; i < 5; i++) svc.guess(view.sessionId, i, 10n);
    svc.guess(view.sessionId, 4, 10n);
    expect(done).toEqual([['u1', 5]]);
  });
});

describe('price-only routes', () => {
  it('runs a game over HTTP', async () => {
    const { app } = setup();
    const started = await app.inject({ method: 'POST', url: '/price-only/start' });
    expect(started.statusCode).toBe(200);
    const view = priceOnlyViewSchema.parse(started.json());
    const got = await app.inject({ method: 'GET', url: `/price-only/${view.sessionId}` });
    expect(priceOnlyViewSchema.parse(got.json()).rounds).toHaveLength(5);
    const ans = await app.inject({ method: 'POST', url: `/price-only/${view.sessionId}/guess`, payload: { index: 0, guessRials: '12345' } });
    expect(ans.statusCode).toBe(200);
    expect(ans.json().result).toMatchObject({ index: 0 });
  });

  it('rejects bad input and unknown sessions', async () => {
    const { app } = setup();
    const view = priceOnlyViewSchema.parse((await app.inject({ method: 'POST', url: '/price-only/start' })).json());
    const post = (id: string, payload: unknown) => app.inject({ method: 'POST', url: `/price-only/${id}/guess`, payload: payload as object });
    expect((await post(view.sessionId, { index: 0, guessRials: '0' })).statusCode).toBe(400);
    expect((await post(view.sessionId, { index: 0, guessRials: 'abc' })).statusCode).toBe(400);
    expect((await post(view.sessionId, { index: 9, guessRials: '5' })).json()).toEqual({ error: 'unknown_round' });
    expect((await post('00000000-0000-7000-8000-000000000001', { index: 0, guessRials: '5' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/price-only/not-a-uuid' })).statusCode).toBe(400);
  });

  it('answers 503 when the catalog is empty', async () => {
    const priceOnly = new PriceOnlyService({ products: async () => ({ catalog: [], items: {} }) }, { rules });
    const app = buildServer({ priceOnly });
    const res = await app.inject({ method: 'POST', url: '/price-only/start' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: 'no_products' });
  });
});
