import type { Rng } from '../game/rng.js';
import { rialsToTomanString } from '../format/toman.js';
import { toPersianDigits } from '../format/persian-digits.js';
import { evaluateRule } from './rules/index.js';
import type { Rule } from './rules/index.js';
import { priceAt } from './price.js';
import { makeRuleContext } from './types.js';
import type { Catalog, CatalogProduct } from './types.js';
import { MIN_NEAR_MISSES, validatePuzzle } from './validate.js';
import type { Level, PuzzleGroupInput, ValidationResult } from './validate.js';

export interface GeneratedPuzzle {
  groups: PuzzleGroupInput[];
  validation: ValidationResult;
}

export interface GenerateOptions {
  maxAttempts?: number;
  /** Cross-group near misses required (the "red herrings"); defaults to the validator's soft minimum. */
  minNearMisses?: number;
}

/** How far the price band reaches either side of its target, by level: easy bands are wide, hard ones narrow (spec §Generator). */
const BAND_PCT: Record<Level, number> = { 0: 40, 1: 25, 2: 15, 3: 8 };

const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)] as T;

function shuffle<T>(list: readonly T[], rng: Rng): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

const yearsWithData = (catalog: Catalog): number[] => {
  const count = new Map<number, number>();
  for (const p of catalog) for (const y of new Set(p.prices.map((x) => x.year))) count.set(y, (count.get(y) ?? 0) + 1);
  return [...count.entries()].filter(([, n]) => n >= 8).map(([y]) => y).sort((a, b) => a - b);
};

/** A price band around the price of a random product in a year with dense data. All money stays integer rials. */
function bandRule(catalog: Catalog, years: readonly number[], level: Level, rng: Rng): Rule | null {
  const year = pick(years, rng);
  const priced = catalog.filter((p) => priceAt(p, year) !== null);
  if (priced.length === 0) return null;
  const target = priceAt(pick(priced, rng), year) as bigint;
  const pct = BigInt(BAND_PCT[level]);
  const min = (target * (100n - pct)) / 100n;
  const max = (target * (100n + pct)) / 100n;
  return { kind: 'price_band_at_year', year, min: Number(min), max: Number(max) };
}

/** "Became about N× dearer between two years" (the hardest kind): N from a random product's real growth. */
function multiplierRule(catalog: Catalog, years: readonly number[], rng: Rng): Rule | null {
  if (years.length < 2) return null;
  const a = Math.floor(rng() * (years.length - 1));
  const yearA = years[a] as number;
  const yearB = years[a + 1 + Math.floor(rng() * (years.length - a - 1))] as number;
  const grown = catalog.filter((p) => {
    const x = priceAt(p, yearA);
    const y = priceAt(p, yearB);
    return x !== null && y !== null && y >= 3n * x;
  });
  if (grown.length === 0) return null;
  const p = pick(grown, rng);
  const ratio = Number((priceAt(p, yearB) as bigint) / (priceAt(p, yearA) as bigint));
  return { kind: 'multiplier_between', yearA, yearB, minX: Math.max(2, Math.floor(ratio * 0.8)), maxX: Math.ceil(ratio * 1.25) };
}

/** An easy anchor: a decade tag shared by enough products. */
function eraRule(catalog: Catalog, rng: Rng): Rule | null {
  const tags = new Map<string, number>();
  for (const p of catalog) for (const t of p.eraTags) tags.set(t, (tags.get(t) ?? 0) + 1);
  const usable = [...tags.entries()].filter(([, n]) => n >= 4).map(([t]) => t);
  return usable.length === 0 ? null : { kind: 'era_icon', eraTag: pick(usable, rng) };
}

function instantiate(level: Level, catalog: Catalog, years: readonly number[], rng: Rng): Rule | null {
  if (level === 3) return (rng() < 0.6 ? multiplierRule(catalog, years, rng) : null) ?? bandRule(catalog, years, 3, rng);
  if (level === 0) return (rng() < 0.5 ? eraRule(catalog, rng) : null) ?? bandRule(catalog, years, 0, rng);
  return bandRule(catalog, years, level, rng);
}

/** Picks 4 candidates, spreading categories first so one category does not take the whole group. */
function chooseFour(cands: readonly CatalogProduct[], rng: Rng): CatalogProduct[] {
  const byCat = new Map<string, CatalogProduct[]>();
  for (const p of shuffle(cands, rng)) (byCat.get(p.category) ?? byCat.set(p.category, []).get(p.category)!).push(p);
  const out: CatalogProduct[] = [];
  while (out.length < 4) {
    for (const list of byCat.values()) {
      const next = list.shift();
      if (next) out.push(next);
      if (out.length === 4) break;
    }
  }
  return out;
}

/**
 * Builds one puzzle from the catalog (approved prices only): hardest level first, each group's rule made from real data, then the whole puzzle is
 * validated (exactly one solution, enough near misses). Returns null when the catalog cannot give one within `maxAttempts`.
 * `rng` is injected so the same seed gives the same puzzle (rule: game-logic randomness is seeded).
 */
export function generatePuzzle(catalog: Catalog, rng: Rng, opts: GenerateOptions = {}): GeneratedPuzzle | null {
  const maxAttempts = opts.maxAttempts ?? 300;
  const minNear = opts.minNearMisses ?? MIN_NEAR_MISSES;
  const years = yearsWithData(catalog);
  if (catalog.length < 16 || years.length === 0) return null;
  const ctx = makeRuleContext(catalog);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const used = new Set<string>();
    const groups: PuzzleGroupInput[] = [];
    for (const level of [3, 2, 1, 0] as const) {
      const rule = instantiate(level, catalog, years, rng);
      if (!rule) break;
      const cands = catalog.filter((p) => !used.has(p.id) && evaluateRule(rule, p, ctx) === 'yes');
      if (cands.length < 4) break;
      const four = chooseFour(cands, rng);
      for (const p of four) used.add(p.id);
      groups.push({ level, rule, productIds: four.map((p) => p.id) });
    }
    if (groups.length !== 4) continue;
    const picked = catalog.filter((p) => used.has(p.id));
    const validation = validatePuzzle({ groups }, picked);
    if (!validation.ok || validation.nearMisses.length < minNear) continue;
    return { groups: groups.sort((a, b) => a.level - b.level), validation };
  }
  return null;
}

/** The rule in plain Persian (also the placeholder title of a generated group until a human writes a witty one). */
export function explainRule(rule: Rule): string {
  switch (rule.kind) {
    case 'price_band_at_year':
      return `سال ${toPersianDigits(String(rule.year))} قیمتشان بین ${rialsToTomanString(BigInt(rule.min))} و ${rialsToTomanString(BigInt(rule.max))} بود`;
    case 'multiplier_between':
      return `از ${toPersianDigits(String(rule.yearA))} تا ${toPersianDigits(String(rule.yearB))} حدود ${toPersianDigits(String(rule.minX))} تا ${toPersianDigits(String(rule.maxX))} برابر گران شدند`;
    case 'era_icon':
      return `ستاره‌های دوره‌ی ${toPersianDigits(rule.eraTag)}`;
    case 'same_price_at_year':
      return `سال ${toPersianDigits(String(rule.year))} همه حدود ${rialsToTomanString(BigInt(rule.target))} بودند`;
    default:
      return 'یک دسته‌ی دستی';
  }
}
