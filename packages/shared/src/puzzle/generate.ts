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
import { profileForLevel } from './difficulty.js';
import type { GenKind, GenerationProfile } from './difficulty.js';
import { THEMES, isThemeTag, themeDef, themeTagOf } from './themes.js';

export interface GeneratedPuzzle {
  groups: PuzzleGroupInput[];
  validation: ValidationResult;
}

export interface GenerateOptions {
  maxAttempts?: number;
  /** Cross-group near misses required (the "red herrings"); defaults to the validator's soft minimum. */
  minNearMisses?: number;
  /**
   * Level of the players the puzzle is for: picks the rule mix, band widths and red-herring count (`profileForLevel`).
   * Omitted = a mid-level player.
   */
  playerLevel?: number;
}

/** Most groups of one puzzle that may share a rule kind, so the four groups stay different in character. */
const MAX_PER_KIND = 2;

/** How far the price band reaches either side of its target, by level: easy bands are wide, hard ones narrow (spec §Generator). */
const BAND_PCT: Record<Level, number> = { 0: 40, 1: 25, 2: 15, 3: 8 };
/** Same idea for "about the same price" tolerances and for the year window of "first crossed". */
const TOLERANCE_PCT: Record<Level, number> = { 0: 30, 1: 20, 2: 12, 3: 6 };
const WINDOW_YEARS: Record<Level, number> = { 0: 8, 1: 6, 2: 3, 3: 1 };

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

const scaled = (n: number, scale: number): number => Math.max(0, Math.round(n * scale));

/** A price band around the price of a random product in a year with dense data. All money stays integer rials. */
function bandRule(catalog: Catalog, years: readonly number[], level: Level, scale: number, rng: Rng): Rule | null {
  const year = pick(years, rng);
  const priced = catalog.filter((p) => priceAt(p, year) !== null);
  if (priced.length === 0) return null;
  const target = priceAt(pick(priced, rng), year) as bigint;
  const pct = BigInt(Math.min(90, scaled(BAND_PCT[level], scale)));
  const min = (target * (100n - pct)) / 100n;
  const max = (target * (100n + pct)) / 100n;
  return { kind: 'price_band_at_year', year, min: Number(min), max: Number(max) };
}

/** "Became about N× dearer between two years" (the hardest kind): N from a random product's real growth. */
function multiplierRule(catalog: Catalog, years: readonly number[], scale: number, rng: Rng): Rule | null {
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
  const lo = Math.max(0.3, 1 - 0.2 * scale);
  const hi = 1 + 0.25 * scale;
  return { kind: 'multiplier_between', yearA, yearB, minX: Math.max(2, Math.floor(ratio * lo)), maxX: Math.ceil(ratio * hi) };
}

/** An easy anchor: a decade tag shared by enough products. */
function eraRule(catalog: Catalog, rng: Rng): Rule | null {
  const tags = new Map<string, number>();
  for (const p of catalog) for (const t of p.eraTags) if (!isThemeTag(t)) tags.set(t, (tags.get(t) ?? 0) + 1);
  const usable = [...tags.entries()].filter(([, n]) => n >= 4).map(([t]) => t);
  return usable.length === 0 ? null : { kind: 'era_icon', eraTag: pick(usable, rng) };
}

/** A hand-tagged association («تو آشپزخونه لازمه»): any theme carried by at least 4 products. */
function themeRule(catalog: Catalog, rng: Rng): Rule | null {
  const usable = THEMES.filter((t) => catalog.filter((p) => p.eraTags.includes(themeTagOf(t.key))).length >= 4);
  return usable.length === 0 ? null : { kind: 'theme_tag', theme: pick(usable, rng).key };
}

/** "All cost about X that year": X from a random product's price, tolerance shrinking with level and player skill. */
function samePriceRule(catalog: Catalog, years: readonly number[], level: Level, scale: number, rng: Rng): Rule | null {
  const year = pick(years, rng);
  const priced = catalog.filter((p) => priceAt(p, year) !== null);
  if (priced.length === 0) return null;
  const target = priceAt(pick(priced, rng), year) as bigint;
  if (target <= 0n) return null;
  const tolerancePct = Math.min(90, Math.max(2, scaled(TOLERANCE_PCT[level], scale)));
  return { kind: 'same_price_at_year', year, target: Number(target), tolerancePct };
}

/** A "nice" number (1, 2 or 5 × 10^k) strictly above `lo` and at most `hi`, or null. */
function niceBetween(lo: bigint, hi: bigint): bigint | null {
  let best: bigint | null = null;
  for (let mag = 1n; mag <= hi; mag *= 10n) {
    for (const m of [1n, 2n, 5n]) {
      const v = m * mag;
      if (v > lo && v <= hi && (best === null || v > best)) best = v;
    }
  }
  return best;
}

/** "First went over X in [from, to]": X a round figure between two consecutive recorded prices of a real product. */
function firstCrossedRule(catalog: Catalog, level: Level, scale: number, rng: Rng): Rule | null {
  const withHistory = catalog.filter((p) => new Set(p.prices.map((x) => x.year)).size >= 3);
  if (withHistory.length === 0) return null;
  const p = pick(withHistory, rng);
  const years = [...new Set(p.prices.map((x) => x.year))].sort((a, b) => a - b);
  const steps: number[] = [];
  for (let i = 1; i < years.length; i++) if ((priceAt(p, years[i] as number) as bigint) > (priceAt(p, years[i - 1] as number) as bigint)) steps.push(i);
  if (steps.length === 0) return null;
  const i = pick(steps, rng);
  const prev = priceAt(p, years[i - 1] as number) as bigint;
  const cur = priceAt(p, years[i] as number) as bigint;
  const threshold = niceBetween(prev, cur - 1n) ?? prev;
  const w = scaled(WINDOW_YEARS[level], scale);
  return { kind: 'first_crossed', threshold: Number(threshold), fromYear: (years[i] as number) - w, toYear: (years[i] as number) + w };
}

/** "Each was cheaper than <product> that year": the reference sits low in the year's price order so enough products fall below it. */
function cheaperThanRefRule(catalog: Catalog, years: readonly number[], rng: Rng): Rule | null {
  const year = pick(years, rng);
  const priced = catalog.filter((p) => priceAt(p, year) !== null).sort((a, b) => Number((priceAt(a, year) as bigint) - (priceAt(b, year) as bigint)));
  if (priced.length < 20) return null;
  const lo = Math.floor(priced.length * 0.08);
  const hi = Math.floor(priced.length * 0.25);
  const ref = priced[lo + Math.floor(rng() * Math.max(1, hi - lo))] as CatalogProduct;
  return { kind: 'cheaper_than_ref', year, refProductId: ref.id };
}

/** "Among the cheapest of its category that year": a category with 6+ priced peers; rank 4-5 keeps the group small and unique. */
function categoryRankRule(catalog: Catalog, years: readonly number[], scale: number, rng: Rng): Rule | null {
  const year = pick(years, rng);
  const byCat = new Map<string, number>();
  for (const p of catalog) if (priceAt(p, year) !== null) byCat.set(p.category, (byCat.get(p.category) ?? 0) + 1);
  const usable = [...byCat.entries()].filter(([, n]) => n >= 6).map(([c]) => c);
  if (usable.length === 0) return null;
  return { kind: 'category_price_rank', year, category: pick(usable, rng), rank: scale >= 1.2 ? 5 : 4 };
}

function instantiate(kind: GenKind, level: Level, catalog: Catalog, years: readonly number[], scale: number, rng: Rng): Rule | null {
  switch (kind) {
    case 'price_band_at_year':
      return bandRule(catalog, years, level, scale, rng);
    case 'same_price_at_year':
      return samePriceRule(catalog, years, level, scale, rng);
    case 'first_crossed':
      return firstCrossedRule(catalog, level, scale, rng);
    case 'multiplier_between':
      return multiplierRule(catalog, years, scale, rng);
    case 'cheaper_than_ref':
      return cheaperThanRefRule(catalog, years, rng);
    case 'era_icon':
      return eraRule(catalog, rng);
    case 'category_price_rank':
      return categoryRankRule(catalog, years, scale, rng);
    case 'theme_tag':
      return themeRule(catalog, rng);
  }
}

/** Kinds still allowed for this group, heaviest weights first by random draw, without replacement. */
function kindOrder(profile: GenerationProfile, level: Level, usedKinds: ReadonlyMap<string, number>, rng: Rng): GenKind[] {
  const left = Object.entries(profile.weights[level]).filter(([k, w]) => (w ?? 0) > 0 && (usedKinds.get(k) ?? 0) < MAX_PER_KIND) as [GenKind, number][];
  const out: GenKind[] = [];
  while (left.length > 0) {
    const total = left.reduce((n, [, w]) => n + w, 0);
    let r = rng() * total;
    let idx = left.findIndex(([, w]) => (r -= w) < 0);
    if (idx < 0) idx = left.length - 1;
    out.push((left.splice(idx, 1)[0] as [GenKind, number])[0]);
  }
  return out;
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
  const profile = profileForLevel(opts.playerLevel ?? 12);
  const minNear = opts.minNearMisses ?? Math.max(MIN_NEAR_MISSES, profile.minNearMisses);
  const years = yearsWithData(catalog);
  if (catalog.length < 16 || years.length === 0) return null;
  const ctx = makeRuleContext(catalog);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const used = new Set<string>();
    const groups: PuzzleGroupInput[] = [];
    const usedKinds = new Map<string, number>();
    for (const level of [3, 2, 1, 0] as const) {
      let made: PuzzleGroupInput | null = null;
      for (const kind of kindOrder(profile, level, usedKinds, rng).slice(0, 4)) {
        const rule = instantiate(kind, level, catalog, years, profile.scale, rng);
        if (!rule) continue;
        const cands = catalog.filter((p) => !used.has(p.id) && evaluateRule(rule, p, ctx) === 'yes');
        if (cands.length < 4) continue;
        const four = chooseFour(cands, rng);
        made = { level, rule, productIds: four.map((p) => p.id) };
        break;
      }
      if (!made) break;
      for (const id of made.productIds) used.add(id);
      usedKinds.set(made.rule.kind, (usedKinds.get(made.rule.kind) ?? 0) + 1);
      groups.push(made);
    }
    if (groups.length !== 4) continue;
    const picked = catalog.filter((p) => used.has(p.id));
    const validation = validatePuzzle({ groups }, picked);
    if (!validation.ok || validation.nearMisses.length < minNear) continue;
    return { groups: groups.sort((a, b) => a.level - b.level), validation };
  }
  return null;
}

/** Persian names of the product categories, for plain-language rule texts. */
export const CATEGORY_FA: Record<string, string> = {
  car: 'خودرو', food: 'خوراکی', snack: 'تنقلات', drink: 'نوشیدنی', digital: 'دیجیتال', electronics: 'لوازم برقی', housing: 'مسکن',
  transport: 'رفت‌وآمد', education: 'آموزش', entertainment: 'سرگرمی', clothing: 'پوشاک', hygiene: 'بهداشتی', service: 'خدمات', other: 'متفرقه',
};

/** The rule in plain Persian (also the explanation of a generated group). `names` maps product ids to names, for rules that point at a product. */
export function explainRule(rule: Rule, names?: ReadonlyMap<string, string>): string {
  const fa = (n: number) => toPersianDigits(String(n));
  switch (rule.kind) {
    case 'price_band_at_year':
      return `سال ${fa(rule.year)} قیمتشان بین ${rialsToTomanString(BigInt(rule.min))} و ${rialsToTomanString(BigInt(rule.max))} بود`;
    case 'multiplier_between':
      return `از ${fa(rule.yearA)} تا ${fa(rule.yearB)} حدود ${fa(rule.minX)} تا ${fa(rule.maxX)} برابر گران شدند`;
    case 'era_icon':
      return `ستاره‌های دوره‌ی ${toPersianDigits(rule.eraTag)}`;
    case 'same_price_at_year':
      return `سال ${fa(rule.year)} همه حدود ${rialsToTomanString(BigInt(rule.target))} بودند`;
    case 'first_crossed':
      return `اولین بار بین سال‌های ${fa(rule.fromYear)} تا ${fa(rule.toYear)} از ${rialsToTomanString(BigInt(rule.threshold))} گذشتند`;
    case 'cheaper_than_ref':
      return `سال ${fa(rule.year)} همه ارزان‌تر از ${names?.get(rule.refProductId) ?? 'یک کالای مرجع'} بودند`;
    case 'category_price_rank':
      return `سال ${fa(rule.year)} جزو ${fa(rule.rank)} ارزان‌ترینِ دسته‌ی ${CATEGORY_FA[rule.category] ?? rule.category} بودند`;
    case 'theme_tag':
      return themeDef(rule.theme)?.explanationFa ?? 'یک موضوع مشترک داشتند';
    default:
      return 'یک دسته‌ی دستی';
  }
}

/** Opening lines for draft titles, several per kind so a batch of puzzles does not read like one template. The admin edits the one they like. */
const TITLE_TEMPLATES: Record<Exclude<Rule['kind'], 'curated' | 'theme_tag'>, readonly string[]> = {
  price_band_at_year: [
    'کیفتان کوک بود؛ ',
    'پولِ توجیبی همین‌قدر می‌خرید: ',
    'اگر آن سال‌ها بودی می‌دانستی: ',
    'قیمت‌های هم‌قدّ: ',
  ],
  same_price_at_year: [
    'یک قیمت، چند کالا؛ ',
    'همه یک‌دست بودند: ',
    'بنگاهِ قیمت‌های دوقلو: ',
  ],
  first_crossed: [
    'روزی که قیمتشان قِد کشید؛ ',
    'لحظه‌ی «آخ، گران شد!»: ',
    'از این‌جا به بعد دیگر ارزان نبودند: ',
  ],
  multiplier_between: [
    'ترن هوایی قیمت؛ ',
    'بزرگ‌ترین جهش‌های قیمتی: ',
    'کاش زودتر خریده بودیم: ',
  ],
  cheaper_than_ref: [
    'از او ارزان‌تر بودند؛ ',
    'زیرِ سقفِ یک مرجع: ',
    'کم‌هزینه‌های آن سال: ',
  ],
  era_icon: [
    'بچه‌ی آن دوره‌ها؛ ',
    'نوستالژی خالص: ',
    'ستاره‌های یک دوران: ',
  ],
  category_price_rank: [
    'ته‌ِ جدولِ گرانی؛ ',
    'ارزان‌های هم‌دسته: ',
    'کف‌نشین‌های قفسه: ',
  ],
};

/**
 * A draft group title: a varied opening + the rule in plain Persian, so players can still deduce the group while the admin polishes the joke.
 * Never a published title by itself (spec: AI titles are human-reviewed).
 */
export function draftTitle(rule: Rule, rng: Rng, names?: ReadonlyMap<string, string>): string {
  if (rule.kind === 'curated') return explainRule(rule, names);
  // A theme's own titles already read as titles; the plain rule follows in the explanation.
  if (rule.kind === 'theme_tag') {
    const titles = themeDef(rule.theme)?.titlesFa ?? [];
    return titles.length > 0 ? (titles[Math.floor(rng() * titles.length)] as string) : explainRule(rule, names);
  }
  const list = TITLE_TEMPLATES[rule.kind];
  return `${list[Math.floor(rng() * list.length)] as string}${explainRule(rule, names)}`;
}
