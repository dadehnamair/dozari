import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../game/rng.js';
import type { CatalogProduct } from '../../puzzle/types.js';
import { selectPriceOnlyRounds } from '../only.js';

const product = (i: number, years: number[]): CatalogProduct => ({
  id: `p${i}`,
  category: 'food',
  eraTags: [],
  prices: years.map((year, k) => ({ year, month: null, priceRials: BigInt((k + 1) * 1000 + i) })),
});
const catalog = Array.from({ length: 12 }, (_, i) => product(i, [1360, 1370, 1380, 1390]));

describe('selectPriceOnlyRounds', () => {
  it('gives the asked number of rounds over distinct products, each with its real price', () => {
    const rounds = selectPriceOnlyRounds(catalog, 5, mulberry32(3));
    expect(rounds).toHaveLength(5);
    expect(new Set(rounds.map((r) => r.productId)).size).toBe(5);
    for (const r of rounds) {
      const p = catalog.find((c) => c.id === r.productId)!;
      expect(p.prices.some((x) => x.year === r.year && x.priceRials === r.actualRials)).toBe(true);
    }
  });

  it('is deterministic for a seed and varies across seeds', () => {
    const a = selectPriceOnlyRounds(catalog, 5, mulberry32(1));
    expect(selectPriceOnlyRounds(catalog, 5, mulberry32(1))).toEqual(a);
    expect(selectPriceOnlyRounds(catalog, 5, mulberry32(2)).map((r) => r.productId)).not.toEqual(a.map((r) => r.productId));
  });

  it('returns fewer rounds when the catalog is small and skips products without a usable price', () => {
    const small = [product(1, [1370]), { id: 'bare', category: 'x', eraTags: [], prices: [] }, product(2, [1380])];
    expect(selectPriceOnlyRounds(small, 5, mulberry32(1)).map((r) => r.productId).sort()).toEqual(['p1', 'p2']);
    expect(selectPriceOnlyRounds([], 5, mulberry32(1))).toEqual([]);
  });
});
