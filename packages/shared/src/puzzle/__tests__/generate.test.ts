import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../game/rng.js';
import { generatePuzzle } from '../generate.js';
import { validatePuzzle } from '../validate.js';
import { product } from './fixtures.js';
import type { CatalogProduct } from '../types.js';

const YEARS = [1365, 1370, 1375, 1380, 1385, 1390, 1395, 1400];
const CATS = ['food', 'snack', 'drink', 'car', 'electronics'];

/** A synthetic catalog: prices grow with random speed, so rules have real structure to find. */
function catalog(n: number, seed: number): CatalogProduct[] {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, (_, i) => {
    let price = Math.floor(10 ** (1 + rng() * 3)); // 10 .. 10 000 rials
    const prices: Record<number, number> = {};
    for (const y of YEARS) {
      prices[y] = price;
      price = Math.floor(price * (1.5 + rng() * 5));
    }
    return product(`p${i}`, CATS[i % CATS.length] as string, prices, i % 3 === 0 ? ['dahe-60'] : i % 3 === 1 ? ['dahe-70'] : []);
  });
}

describe('generatePuzzle', () => {
  it('is reproducible from a seed', () => {
    const c = catalog(150, 1);
    const a = generatePuzzle(c, mulberry32(7));
    const b = generatePuzzle(c, mulberry32(7));
    expect(a).not.toBeNull();
    expect(a!.groups).toEqual(b!.groups);
  });

  it('always returns a puzzle that passes the validator (exactly one solution) with the required red herrings', () => {
    let made = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const c = catalog(150, seed);
      const out = generatePuzzle(c, mulberry32(seed * 31));
      if (!out) continue;
      made++;
      const used = new Set(out.groups.flatMap((g) => g.productIds));
      expect(used.size).toBe(16);
      expect(out.groups.map((g) => g.level)).toEqual([0, 1, 2, 3]);
      const check = validatePuzzle({ groups: out.groups }, c.filter((p) => used.has(p.id)));
      expect(check.ok).toBe(true);
      expect(check.nearMisses.length).toBeGreaterThanOrEqual(2);
      for (const g of out.groups) expect(g.productIds).toHaveLength(4);
    }
    expect(made).toBe(25); // a catalog of 150 products always works (measured 20/20 at 150; 14/20 at 90, 6/20 at 60)
  });

  it('gives up cleanly (null) on a catalog too small or without data', () => {
    expect(generatePuzzle(catalog(10, 1), mulberry32(1))).toBeNull();
    expect(generatePuzzle(Array.from({ length: 40 }, (_, i) => product(`x${i}`, 'food', {})), mulberry32(1))).toBeNull();
  });

  it('keeps every money value an integer', () => {
    const out = generatePuzzle(catalog(150, 3), mulberry32(5));
    expect(out).not.toBeNull();
    for (const g of out!.groups) {
      const r = g.rule as Record<string, unknown>;
      for (const k of ['min', 'max', 'target', 'threshold']) if (k in r) expect(Number.isInteger(r[k])).toBe(true);
    }
  });
});

describe('explainRule', () => {
  it('says each rule in plain Persian with toman, never raw rials', async () => {
    const { explainRule } = await import('../generate.js');
    expect(explainRule({ kind: 'price_band_at_year', year: 1375, min: 900_000, max: 1_100_000 })).toContain('۱۳۷۵');
    expect(explainRule({ kind: 'multiplier_between', yearA: 1370, yearB: 1400, minX: 80, maxX: 120 })).toContain('برابر');
    expect(explainRule({ kind: 'era_icon', eraTag: 'dahe-60' })).toContain('۶۰');
    expect(explainRule({ kind: 'curated', note: 'x' })).toBeTruthy();
  });
});
