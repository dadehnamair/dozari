/**
 * Group rule evaluators (docs/logic/puzzle-generation.md §Rule types). Pure; all money is
 * integer rials as `bigint` (rule 2) so band/tolerance/multiplier checks never touch floats.
 */

export interface CatalogProduct {
  id: string;
  category: string;
  eraTags: readonly string[];
  /** Solar Hijri year → nominal rials. Approved points only (median already taken if monthly). */
  prices: ReadonlyMap<number, bigint>;
}

export type Rule =
  | { kind: 'era_icon'; eraTag: string }
  | { kind: 'price_band_at_year'; year: number; min: bigint; max: bigint }
  | { kind: 'same_price_at_year'; year: number; target: bigint; tolerancePct: number }
  | { kind: 'first_crossed'; threshold: bigint; fromYear: number; toYear: number }
  | { kind: 'multiplier_between'; yearA: number; yearB: number; minX: bigint }
  /** Hand-made group: validator skips rule checks, a human approves it. */
  | { kind: 'curated'; note?: string };

export function priceAt(p: CatalogProduct, year: number): bigint | null {
  return p.prices.get(year) ?? null;
}

/** First year (ascending) whose price is at or above `threshold`. */
function firstYearAtOrAbove(p: CatalogProduct, threshold: bigint): number | null {
  const years = [...p.prices.keys()].sort((a, b) => a - b);
  for (const y of years) if ((p.prices.get(y) as bigint) >= threshold) return y;
  return null;
}

const abs = (n: bigint) => (n < 0n ? -n : n);

export function satisfies(rule: Rule, p: CatalogProduct): boolean {
  switch (rule.kind) {
    case 'era_icon':
      return p.eraTags.includes(rule.eraTag);
    case 'price_band_at_year': {
      const v = priceAt(p, rule.year);
      return v !== null && v >= rule.min && v <= rule.max;
    }
    case 'same_price_at_year': {
      const v = priceAt(p, rule.year);
      return v !== null && abs(v - rule.target) * 100n <= rule.target * BigInt(rule.tolerancePct);
    }
    case 'first_crossed': {
      const y = firstYearAtOrAbove(p, rule.threshold);
      return y !== null && y >= rule.fromYear && y <= rule.toYear;
    }
    case 'multiplier_between': {
      const a = priceAt(p, rule.yearA);
      const b = priceAt(p, rule.yearB);
      return a !== null && b !== null && b >= a * rule.minX;
    }
    case 'curated':
      return false;
  }
}

/** Years a rule needs an approved price for (puzzle-generation.md §Validation 2). */
export function requiredYears(rule: Rule): number[] {
  switch (rule.kind) {
    case 'price_band_at_year':
    case 'same_price_at_year':
      return [rule.year];
    case 'multiplier_between':
      return [rule.yearA, rule.yearB];
    default:
      return [];
  }
}

/** True when the item has at least the data the rule needs to be evaluated at all. */
export function hasDataFor(rule: Rule, p: CatalogProduct): boolean {
  if (rule.kind === 'first_crossed') return p.prices.size > 0;
  return requiredYears(rule).every((y) => p.prices.has(y));
}

/** Widened rule (+30% band etc.) used to count red-herring near misses (§Validation 5). */
export function relax(rule: Rule): Rule {
  switch (rule.kind) {
    case 'price_band_at_year':
      return { ...rule, min: (rule.min * 70n) / 100n, max: (rule.max * 130n) / 100n };
    case 'same_price_at_year':
      return { ...rule, tolerancePct: Math.round(rule.tolerancePct * 1.5) };
    case 'first_crossed':
      return { ...rule, fromYear: rule.fromYear - 5, toYear: rule.toYear + 5 };
    case 'multiplier_between':
      return { ...rule, minX: (rule.minX * 70n) / 100n };
    default:
      return rule;
  }
}
