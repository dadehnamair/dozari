import type { CatalogPricePoint } from './types.js';

export interface PriceMark {
  year: number;
  month: number | null;
  priceRials: bigint;
}

export interface PriceRange {
  /** Number of price points considered. */
  count: number;
  /** Earliest / latest dated point (a missing month sorts before month 1 of the same year). */
  first: PriceMark;
  last: PriceMark;
  /** Cheapest / dearest nominal price seen (rule 1: never inflation-adjusted). */
  min: PriceMark;
  max: PriceMark;
}

const monthKey = (p: { year: number; month: number | null }) => p.year * 13 + (p.month ?? 0);

/** Date span and price span of a product's price points, or null when it has none. Pure; callers pass approved points only. */
export function priceRange(prices: readonly CatalogPricePoint[]): PriceRange | null {
  if (prices.length === 0) return null;
  let first = prices[0] as CatalogPricePoint;
  let last = first;
  let min = first;
  let max = first;
  for (const p of prices) {
    if (monthKey(p) < monthKey(first)) first = p;
    if (monthKey(p) > monthKey(last)) last = p;
    if (p.priceRials < min.priceRials) min = p;
    if (p.priceRials > max.priceRials) max = p;
  }
  return { count: prices.length, first, last, min, max };
}

/**
 * Price on a given date: the exact month when there is one, else the year's own value (median of its points,
 * same rule as `priceAt`). Never interpolates; null when that date has no data.
 */
export function priceOnDate(prices: readonly CatalogPricePoint[], year: number, month: number | null): bigint | null {
  if (month !== null) {
    const exact = prices.find((p) => p.year === year && p.month === month);
    if (exact) return exact.priceRials;
  }
  const inYear = prices.filter((p) => p.year === year).map((p) => p.priceRials).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (inYear.length === 0) return null;
  const mid = inYear.length >> 1;
  return inYear.length % 2 === 1 ? (inYear[mid] as bigint) : ((inYear[mid - 1] as bigint) + (inYear[mid] as bigint)) / 2n;
}
