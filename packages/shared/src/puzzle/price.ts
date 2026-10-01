import type { CatalogProduct } from './types.js';

/**
 * Nominal price (integer rials) of a product in a Solar Hijri year: the exact approved point for
 * that year, or the median when several months exist. No interpolation (data-model.md §price_points).
 */
export function priceAt(product: CatalogProduct, year: number): bigint | null {
  const values = product.prices
    .filter((p) => p.year === year)
    .map((p) => p.priceRials)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (values.length === 0) return null;
  const mid = values.length >> 1;
  if (values.length % 2 === 1) return values[mid] as bigint;
  return ((values[mid - 1] as bigint) + (values[mid] as bigint)) / 2n;
}
