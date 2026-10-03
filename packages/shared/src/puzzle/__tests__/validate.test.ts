import { describe, expect, it } from 'vitest';
import {
  type CatalogProduct,
  type PuzzleDraft,
  type Rule,
  satisfies,
  validatePuzzle,
} from '../index.js';

const prod = (
  id: string,
  category: string,
  prices: Record<number, number>,
  eraTags: string[] = [],
): CatalogProduct => ({
  id,
  category,
  eraTags,
  prices: new Map(Object.entries(prices).map(([y, r]) => [Number(y), BigInt(r)])),
});

describe('satisfies', () => {
  const p = prod('a', 'food', { 1370: 1000, 1380: 100000, 1390: 5000000 }, ['dahe-70']);
  it('era_icon', () => {
    expect(satisfies({ kind: 'era_icon', eraTag: 'dahe-70' }, p)).toBe(true);
    expect(satisfies({ kind: 'era_icon', eraTag: 'dahe-60' }, p)).toBe(false);
  });
  it('price_band_at_year is inclusive and false on missing data', () => {
    const r = (year: number): Rule => ({
      kind: 'price_band_at_year',
      year,
      min: 1000n,
      max: 2000n,
    });
    expect(satisfies(r(1370), p)).toBe(true);
    expect(satisfies(r(1380), p)).toBe(false);
    expect(satisfies(r(1375), p)).toBe(false);
  });
  it('same_price_at_year uses integer tolerance', () => {
    const r: Rule = { kind: 'same_price_at_year', year: 1370, target: 1100n, tolerancePct: 10 };
    expect(satisfies(r, p)).toBe(true); // |1000-1100| = 100 <= 110
    expect(satisfies({ ...r, tolerancePct: 5 }, p)).toBe(false);
  });
  it('first_crossed finds the first year at/above the threshold', () => {
    const r: Rule = { kind: 'first_crossed', threshold: 100000n, fromYear: 1375, toYear: 1385 };
    expect(satisfies(r, p)).toBe(true);
    expect(satisfies({ ...r, fromYear: 1381, toYear: 1389 }, p)).toBe(false);
  });
  it('multiplier_between needs both years', () => {
    const r: Rule = { kind: 'multiplier_between', yearA: 1370, yearB: 1390, minX: 5000n };
    expect(satisfies(r, p)).toBe(true);
    expect(satisfies({ ...r, minX: 5001n }, p)).toBe(false);
    expect(satisfies({ ...r, yearB: 1395 }, p)).toBe(false);
  });
});

describe('validatePuzzle', () => {
  // 16 products; group g (0..3) has price 1000*(g+1)*10 at 1370 so each band is disjoint.
  const catalog = new Map<string, CatalogProduct>();
  const cats = ['food', 'drink', 'car', 'service'];
  for (let g = 0; g < 4; g++) {
    for (let i = 0; i < 4; i++) {
      const id = `p${g}${i}`;
      catalog.set(id, prod(id, cats[(g + i) % 4] as string, { 1370: 10_000 * (g + 1) + i }));
    }
  }
  const puzzle = (): PuzzleDraft => ({
    groups: [0, 1, 2, 3].map((g) => ({
      level: g,
      rule: {
        kind: 'price_band_at_year',
        year: 1370,
        min: BigInt(10_000 * (g + 1)),
        max: BigInt(10_000 * (g + 1) + 3),
      },
      items: [0, 1, 2, 3].map((i) => `p${g}${i}`),
    })),
  });

  it('accepts a well-formed unique puzzle', () => {
    const r = validatePuzzle(puzzle(), catalog);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('rejects bad shape (duplicate item)', () => {
    const pz = puzzle();
    (pz.groups[1]!.items as string[])[0] = 'p00';
    expect(validatePuzzle(pz, catalog).ok).toBe(false);
  });

  it('rejects an item that fails its own rule', () => {
    const pz = puzzle();
    (pz.groups[0] as { rule: Rule }).rule = {
      kind: 'price_band_at_year',
      year: 1370,
      min: 10_000n,
      max: 10_001n,
    };
    const r = validatePuzzle(pz, catalog);
    expect(r.errors.some((e) => e.startsWith('membership'))).toBe(true);
  });

  it('rejects ambiguous puzzles: an outsider fits another group', () => {
    const pz = puzzle();
    (pz.groups[0] as { rule: Rule }).rule = {
      kind: 'price_band_at_year',
      year: 1370,
      min: 10_000n,
      max: 20_003n,
    };
    const r = validatePuzzle(pz, catalog);
    expect(r.errors.some((e) => e.startsWith('uniqueness'))).toBe(true);
  });

  it('reports missing price data', () => {
    const c = new Map(catalog);
    c.set('p00', prod('p00', 'food', {}));
    expect(validatePuzzle(puzzle(), c).errors.some((e) => e.startsWith('data'))).toBe(true);
  });

  it('counts near misses from relaxed rules instead of warning when there are enough', () => {
    const r = validatePuzzle(puzzle(), catalog);
    expect(r.nearMisses).toBeGreaterThanOrEqual(2);
    expect(r.warnings.some((w) => w.startsWith('red herrings'))).toBe(false);
  });

  it('skips rule checks for curated groups', () => {
    const pz = puzzle();
    (pz.groups[2] as { rule: Rule }).rule = { kind: 'curated' };
    expect(validatePuzzle(pz, catalog).ok).toBe(true);
  });
});
