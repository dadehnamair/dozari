import { describe, expect, it } from 'vitest';
import { priceAt } from '../price.js';
import { evaluateRule, relaxRule, ruleSchema } from '../rules/index.js';
import type { Rule } from '../rules/index.js';
import { makeRuleContext } from '../types.js';
import { product } from './fixtures.js';

const evalOne = (rule: Rule, p: ReturnType<typeof product>, others: ReturnType<typeof product>[] = []) =>
  evaluateRule(rule, p, makeRuleContext([p, ...others]));

describe('priceAt', () => {
  it('returns the exact year, the median of several months, and null when missing', () => {
    const p = { id: 'x', category: 'food', eraTags: [], prices: [
      { year: 1375, month: 1, priceRials: 100n },
      { year: 1375, month: 6, priceRials: 300n },
      { year: 1375, month: 9, priceRials: 200n },
      { year: 1380, month: null, priceRials: 10n },
      { year: 1380, month: 2, priceRials: 21n },
    ] };
    expect(priceAt(p, 1375)).toBe(200n);
    expect(priceAt(p, 1380)).toBe(15n); // (10 + 21) / 2 floored
    expect(priceAt(p, 1399)).toBeNull();
  });
});

describe('evaluateRule', () => {
  const p = product('p', 'snack', { 1370: 100, 1375: 1_000, 1380: 5_000, 1390: 80_000, 1400: 10_000 }, ['dahe-70']);

  it('price_band_at_year is inclusive and reports missing data', () => {
    const r = (min: number, max: number): Rule => ({ kind: 'price_band_at_year', year: 1375, min, max });
    expect(evalOne(r(1_000, 2_000), p)).toBe('yes');
    expect(evalOne(r(500, 1_000), p)).toBe('yes');
    expect(evalOne(r(1_001, 2_000), p)).toBe('no');
    expect(evalOne({ kind: 'price_band_at_year', year: 1399, min: 0, max: 9 }, p)).toBe('unknown');
  });

  it('same_price_at_year uses an integer tolerance', () => {
    const r = (tolerancePct: number): Rule => ({ kind: 'same_price_at_year', year: 1380, target: 4_500, tolerancePct });
    expect(evalOne(r(12), p)).toBe('yes'); // |5000-4500|*100 = 50_000 <= 4500*12 = 54_000
    expect(evalOne(r(11), p)).toBe('no'); // 49_500 < 50_000
  });

  it('first_crossed needs an earlier point below the threshold', () => {
    const r = (fromYear: number, toYear: number): Rule => ({ kind: 'first_crossed', threshold: 50_000, fromYear, toYear });
    expect(evalOne(r(1385, 1395), p)).toBe('yes'); // first above 50k at 1390
    expect(evalOne(r(1391, 1399), p)).toBe('no');
    expect(evalOne({ kind: 'first_crossed', threshold: 10_000_000, fromYear: 1300, toYear: 1450 }, p)).toBe('no'); // never
    expect(evalOne({ kind: 'first_crossed', threshold: 50, fromYear: 1300, toYear: 1450 }, p)).toBe('unknown'); // already above at first point
  });

  it('multiplier_between compares year B to year A', () => {
    const r = (minX: number, maxX: number): Rule => ({ kind: 'multiplier_between', yearA: 1370, yearB: 1375, minX, maxX });
    expect(evalOne(r(10, 10), p)).toBe('yes');
    expect(evalOne(r(11, 20), p)).toBe('no');
    expect(evalOne({ kind: 'multiplier_between', yearA: 1360, yearB: 1375, minX: 1, maxX: 9 }, p)).toBe('unknown');
  });

  it('cheaper_than_ref is strict, never true for the reference itself, unknown without a ref price', () => {
    const ref = product('ref', 'car', { 1380: 5_001 });
    const rule: Rule = { kind: 'cheaper_than_ref', year: 1380, refProductId: 'ref' };
    expect(evalOne(rule, p, [ref])).toBe('yes');
    expect(evalOne(rule, ref, [])).toBe('no');
    expect(evalOne(rule, p, [])).toBe('unknown');
    expect(evalOne(rule, product('eq', 'food', { 1380: 5_001 }), [ref])).toBe('no');
  });

  it('era_icon checks tags only', () => {
    expect(evalOne({ kind: 'era_icon', eraTag: 'dahe-70' }, p)).toBe('yes');
    expect(evalOne({ kind: 'era_icon', eraTag: 'dahe-60' }, p)).toBe('no');
  });

  it('category_price_rank ranks within the category at that year', () => {
    const cheap = product('cheap', 'snack', { 1370: 10 });
    const mid = product('mid', 'snack', { 1370: 20 });
    const dear = product('dear', 'snack', { 1370: 30 });
    const car = product('car', 'car', { 1370: 5 });
    const all = [cheap, mid, dear, car];
    const rule = (rank: number): Rule => ({ kind: 'category_price_rank', year: 1370, category: 'snack', rank });
    expect(evalOne(rule(1), cheap, all)).toBe('yes');
    expect(evalOne(rule(1), mid, all)).toBe('no');
    expect(evalOne(rule(2), mid, all)).toBe('yes');
    expect(evalOne(rule(2), car, all)).toBe('no'); // other category
    expect(evalOne(rule(1), product('nodata', 'snack', {}), all)).toBe('unknown');
  });

  it('curated rules are never machine-judged', () => {
    expect(evalOne({ kind: 'curated', note: 'x' }, p)).toBe('unknown');
  });
});

describe('ruleSchema', () => {
  it('parses valid rules and rejects inverted ranges', () => {
    expect(ruleSchema.safeParse({ kind: 'era_icon', eraTag: 'dahe-60' }).success).toBe(true);
    expect(ruleSchema.safeParse({ kind: 'price_band_at_year', year: 1375, min: 9, max: 1 }).success).toBe(false);
    expect(ruleSchema.safeParse({ kind: 'first_crossed', threshold: 1, fromYear: 1400, toYear: 1390 }).success).toBe(false);
    expect(ruleSchema.safeParse({ kind: 'nope' }).success).toBe(false);
  });

  it('rejects fractional rials (rule 2)', () => {
    expect(ruleSchema.safeParse({ kind: 'price_band_at_year', year: 1375, min: 1.5, max: 9 }).success).toBe(false);
  });
});

describe('relaxRule', () => {
  it('widens bands by ~30% with integer rounding and leaves unrelaxable kinds alone', () => {
    expect(relaxRule({ kind: 'price_band_at_year', year: 1375, min: 100, max: 200 })).toEqual({ kind: 'price_band_at_year', year: 1375, min: 70, max: 260 });
    expect(relaxRule({ kind: 'era_icon', eraTag: 'x' })).toBeNull();
    expect(relaxRule({ kind: 'curated', note: '' })).toBeNull();
  });
});
