import { priceAt } from '../price.js';
import { themeTagOf } from '../themes.js';
import type { CatalogProduct, RuleContext, Tri } from '../types.js';
import type { Rule } from './schemas.js';

const yn = (b: boolean): Tri => (b ? 'yes' : 'no');
const abs = (n: bigint) => (n < 0n ? -n : n);

type Of<K extends Rule['kind']> = Extract<Rule, { kind: K }>;

function priceBandAtYear(rule: Of<'price_band_at_year'>, product: CatalogProduct): Tri {
  const p = priceAt(product, rule.year);
  if (p === null) return 'unknown';
  return yn(p >= BigInt(rule.min) && p <= BigInt(rule.max));
}

function samePriceAtYear(rule: Of<'same_price_at_year'>, product: CatalogProduct): Tri {
  const p = priceAt(product, rule.year);
  if (p === null) return 'unknown';
  const target = BigInt(rule.target);
  // |p - target| <= target * tol / 100, kept in integers.
  return yn(abs(p - target) * 100n <= target * BigInt(rule.tolerancePct));
}

/**
 * "First went over `threshold` during [fromYear, toYear]", judged on recorded points: the first
 * year (in the product's data) whose price is above the threshold must fall in the range, and an
 * earlier point must show it was not already above. Never crossed => no; crossed at its very
 * first data point => unknown (we cannot tell when it actually crossed).
 */
function firstCrossed(rule: Of<'first_crossed'>, product: CatalogProduct): Tri {
  const years = [...new Set(product.prices.map((p) => p.year))].sort((a, b) => a - b);
  if (years.length === 0) return 'unknown';
  const threshold = BigInt(rule.threshold);
  for (let i = 0; i < years.length; i++) {
    const year = years[i] as number;
    const p = priceAt(product, year) as bigint;
    if (p > threshold) {
      if (i === 0) return 'unknown';
      return yn(year >= rule.fromYear && year <= rule.toYear);
    }
  }
  return 'no';
}

function multiplierBetween(rule: Of<'multiplier_between'>, product: CatalogProduct): Tri {
  const a = priceAt(product, rule.yearA);
  const b = priceAt(product, rule.yearB);
  if (a === null || b === null) return 'unknown';
  return yn(b >= BigInt(rule.minX) * a && b <= BigInt(rule.maxX) * a);
}

function cheaperThanRef(rule: Of<'cheaper_than_ref'>, product: CatalogProduct, ctx: RuleContext): Tri {
  if (product.id === rule.refProductId) return 'no';
  const ref = ctx.byId.get(rule.refProductId);
  const p = priceAt(product, rule.year);
  const r = ref ? priceAt(ref, rule.year) : null;
  if (p === null || r === null) return 'unknown';
  return yn(p < r);
}

function eraIcon(rule: Of<'era_icon'>, product: CatalogProduct): Tri {
  return yn(product.eraTags.includes(rule.eraTag));
}

function themeTag(rule: Of<'theme_tag'>, product: CatalogProduct): Tri {
  return yn(product.eraTags.includes(themeTagOf(rule.theme)));
}

/** Rank among catalog peers that have a price that year; ties share the better rank. */
function categoryPriceRank(rule: Of<'category_price_rank'>, product: CatalogProduct, ctx: RuleContext): Tri {
  if (product.category !== rule.category) return 'no';
  const p = priceAt(product, rule.year);
  if (p === null) return 'unknown';
  let cheaper = 0;
  for (const peer of ctx.catalog) {
    if (peer.category !== rule.category || peer.id === product.id) continue;
    const q = priceAt(peer, rule.year);
    if (q !== null && q < p) cheaper++;
  }
  return yn(cheaper + 1 <= rule.rank);
}

/** Does `product` satisfy `rule`? `curated` rules are human-judged, so they are always `unknown`. */
export function evaluateRule(rule: Rule, product: CatalogProduct, ctx: RuleContext): Tri {
  switch (rule.kind) {
    case 'price_band_at_year':
      return priceBandAtYear(rule, product);
    case 'same_price_at_year':
      return samePriceAtYear(rule, product);
    case 'first_crossed':
      return firstCrossed(rule, product);
    case 'multiplier_between':
      return multiplierBetween(rule, product);
    case 'cheaper_than_ref':
      return cheaperThanRef(rule, product, ctx);
    case 'era_icon':
      return eraIcon(rule, product);
    case 'category_price_rank':
      return categoryPriceRank(rule, product, ctx);
    case 'theme_tag':
      return themeTag(rule, product);
    case 'curated':
      return 'unknown';
  }
}
