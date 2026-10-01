import type { CatalogProduct } from '../types.js';

type Prices = Record<number, number>;

/** Build a product from `{ year: rials }` (rials are integers). */
export function product(id: string, category: string, prices: Prices, eraTags: string[] = []): CatalogProduct {
  return {
    id,
    category,
    eraTags,
    prices: Object.entries(prices).map(([year, rials]) => ({ year: Number(year), month: null, priceRials: BigInt(rials) })),
  };
}

const cats = ['food', 'snack', 'drink', 'car'];

/**
 * 16 products, 4 per group, designed so that exactly one assignment works:
 *  A (level 0): era_icon dahe-60
 *  B (level 1): price_band_at_year 1375 in [900_000, 1_100_000]
 *  C (level 2): same_price_at_year 1380 target 5_000_000 +-10%
 *  D (level 3): multiplier_between 1370 -> 1400 in [80, 120]
 * A1/A2 sit just above B's band, so they are "near misses" for B.
 */
export function fixtureCatalog(): CatalogProduct[] {
  const out: CatalogProduct[] = [];
  for (let i = 1; i <= 4; i++) {
    const cat = cats[i - 1] as string;
    const a1375 = i <= 2 ? 1_250_000 + (i - 1) * 50_000 : 6_000_000;
    out.push(product(`a${i}`, cat, { 1370: 100, 1375: a1375, 1380: 20_000_000, 1400: 100 }, ['dahe-60']));
    out.push(product(`b${i}`, cat, { 1370: 100, 1375: 900_000 + i * 50_000, 1380: 30_000_000, 1400: 100 }));
    out.push(product(`c${i}`, cat, { 1370: 100, 1375: 20_000_000, 1380: 4_800_000 + i * 100_000, 1400: 100 }));
    out.push(product(`d${i}`, cat, { 1370: 10_000, 1375: 40_000_000, 1380: 60_000_000, 1400: 1_000_000 }));
  }
  return out;
}

export const fixtureGroups = [
  { level: 0 as const, rule: { kind: 'era_icon' as const, eraTag: 'dahe-60' }, productIds: ['a1', 'a2', 'a3', 'a4'] },
  { level: 1 as const, rule: { kind: 'price_band_at_year' as const, year: 1375, min: 900_000, max: 1_100_000 }, productIds: ['b1', 'b2', 'b3', 'b4'] },
  { level: 2 as const, rule: { kind: 'same_price_at_year' as const, year: 1380, target: 5_000_000, tolerancePct: 10 }, productIds: ['c1', 'c2', 'c3', 'c4'] },
  { level: 3 as const, rule: { kind: 'multiplier_between' as const, yearA: 1370, yearB: 1400, minX: 80, maxX: 120 }, productIds: ['d1', 'd2', 'd3', 'd4'] },
];
