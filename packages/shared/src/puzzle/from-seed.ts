import { type SeedProduct, type SeedRule, seedPriceToRials } from '../schemas/index.js';
import type { CatalogProduct, Rule } from './rules.js';

const tomanToRials = (t: number) => BigInt(Math.round(t * 10));

export function seedRuleToRule(r: SeedRule): Rule {
  switch (r.kind) {
    case 'era_icon':
      return { kind: r.kind, eraTag: r.era_tag };
    case 'price_band_at_year':
      return {
        kind: r.kind,
        year: r.year,
        min: tomanToRials(r.min_toman),
        max: tomanToRials(r.max_toman),
      };
    case 'same_price_at_year':
      return {
        kind: r.kind,
        year: r.year,
        target: tomanToRials(r.target_toman),
        tolerancePct: r.tolerance_pct,
      };
    case 'first_crossed':
      return {
        kind: r.kind,
        threshold: tomanToRials(r.threshold_toman),
        fromYear: r.from_year,
        toYear: r.to_year,
      };
    case 'multiplier_between':
      return {
        kind: r.kind,
        yearA: r.year_a,
        yearB: r.year_b,
        minX: BigInt(Math.round(r.min_multiplier)),
      };
  }
}

/**
 * Catalog keyed by slug for validating seed puzzles. Only `approved` price points count unless
 * `includePending` (dev/test use while prices are still unverified, see DECISIONS D64).
 */
export function catalogFromSeed(
  products: readonly SeedProduct[],
  opts: { includePending?: boolean } = {},
): Map<string, CatalogProduct> {
  const out = new Map<string, CatalogProduct>();
  for (const p of products) {
    const prices = new Map<number, bigint>();
    for (const pt of p.prices) {
      if (pt.status === 'rejected' || (pt.status === 'pending' && !opts.includePending)) continue;
      prices.set(pt.year, seedPriceToRials(pt));
    }
    out.set(p.slug, { id: p.slug, category: p.category, eraTags: p.era_tags, prices });
  }
  return out;
}
