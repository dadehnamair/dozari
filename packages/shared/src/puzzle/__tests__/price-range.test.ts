import { describe, expect, it } from 'vitest';
import { priceOnDate, priceRange } from '../price-range.js';

const pts = [
  { year: 1380, month: null, priceRials: 5000n },
  { year: 1375, month: 6, priceRials: 1000n },
  { year: 1375, month: 2, priceRials: 900n },
  { year: 1390, month: 1, priceRials: 40000n },
];

describe('priceRange', () => {
  it('is null without points', () => expect(priceRange([])).toBeNull());
  it('finds the date and price span', () => {
    const r = priceRange(pts)!;
    expect(r.count).toBe(4);
    expect(r.first).toMatchObject({ year: 1375, month: 2 });
    expect(r.last).toMatchObject({ year: 1390, month: 1 });
    expect(r.min.priceRials).toBe(900n);
    expect(r.max.priceRials).toBe(40000n);
  });
});

describe('priceOnDate', () => {
  it('prefers the exact month, falls back to the year, never interpolates', () => {
    expect(priceOnDate(pts, 1375, 6)).toBe(1000n);
    expect(priceOnDate(pts, 1375, 9)).toBe(950n);
    expect(priceOnDate(pts, 1380, null)).toBe(5000n);
    expect(priceOnDate(pts, 1385, null)).toBeNull();
  });
});
