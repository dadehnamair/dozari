import type { Rule } from './schemas.js';

const floorPct = (n: number, pct: number) => Number((BigInt(n) * BigInt(pct)) / 100n);
const ceilPct = (n: number, pct: number) => Number((BigInt(n) * BigInt(pct) + 99n) / 100n);

/**
 * A ~30% looser version of a rule, used to find "near misses" (red herrings): items that almost
 * fit another group. Returns null for kinds that have no meaningful relaxation.
 */
export function relaxRule(rule: Rule): Rule | null {
  switch (rule.kind) {
    case 'price_band_at_year':
      return { ...rule, min: floorPct(rule.min, 70), max: ceilPct(rule.max, 130) };
    case 'same_price_at_year':
      return { ...rule, tolerancePct: Math.min(100, Math.ceil(rule.tolerancePct * 1.3)) };
    case 'multiplier_between':
      return { ...rule, minX: Math.max(1, Math.floor((rule.minX * 70) / 100)), maxX: Math.ceil((rule.maxX * 130) / 100) };
    case 'first_crossed':
      return { ...rule, fromYear: rule.fromYear - 3, toYear: rule.toYear + 3 };
    case 'category_price_rank':
      return { ...rule, rank: rule.rank + 2 };
    default:
      return null;
  }
}

/** Rough 0..1 difficulty of a rule (higher = harder), used for the soft difficulty-ordering check. */
export function estimateDifficulty(rule: Rule, level: number): number {
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  switch (rule.kind) {
    case 'era_icon':
      return 0.1;
    case 'price_band_at_year': {
      const ratio = rule.max / Math.max(1, rule.min);
      return clamp(1 - Math.log(Math.max(1, ratio)) / Math.log(4));
    }
    case 'same_price_at_year':
      return clamp(1 - rule.tolerancePct / 50);
    case 'category_price_rank':
      return clamp(0.7 - 0.05 * rule.rank);
    case 'cheaper_than_ref':
      return 0.7;
    case 'first_crossed':
      return 0.8;
    case 'multiplier_between':
      return 0.9;
    case 'curated':
      return level / 3;
  }
}
