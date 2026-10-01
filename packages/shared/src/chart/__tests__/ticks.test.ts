import { describe, expect, it } from 'vitest';
import { lineSegments, xTicks, yTicks } from '../ticks.js';

const pt = (year: number, breakBefore = false) => ({ year, rials: 1n, breakBefore });

describe('chart ticks', () => {
  it('puts y ticks on powers of ten inside the domain', () => {
    expect(yTicks({ minRials: 50n, maxRials: 20_000n })).toEqual([100n, 1_000n, 10_000n]);
  });
  it('falls back to the domain ends (or one tick) when fewer than two decades fit', () => {
    expect(yTicks({ minRials: 120n, maxRials: 900n })).toEqual([120n, 900n]);
    expect(yTicks({ minRials: 500n, maxRials: 500n })).toEqual([500n]);
  });
  it('spreads linear y ticks evenly from min to max', () => {
    expect(yTicks({ minRials: 100n, maxRials: 500n }, 'linear')).toEqual([100n, 200n, 300n, 400n, 500n]);
    expect(yTicks({ minRials: 7n, maxRials: 7n }, 'linear')).toEqual([7n]);
  });
  it('puts x ticks on multiples of five years', () => {
    expect(xTicks({ min: 1372, max: 1401 })).toEqual([1375, 1380, 1385, 1390, 1395, 1400]);
    expect(xTicks({ min: 1371, max: 1374 })).toEqual([1371, 1374]);
    expect(xTicks({ min: 1390, max: 1390 })).toEqual([1390]);
  });
  it('splits lines at breaks', () => {
    expect(lineSegments([pt(1), pt(2), pt(9, true), pt(10)]).map((r) => r.map((p) => p.year))).toEqual([[1, 2], [9, 10]]);
    expect(lineSegments([])).toEqual([]);
  });
});
