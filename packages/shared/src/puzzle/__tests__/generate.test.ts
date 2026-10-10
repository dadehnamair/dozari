import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../game/rng.js';
import { draftTitle, explainRule, generatePuzzle } from '../generate.js';
import { profileForLevel } from '../difficulty.js';
import { THEMES, themeTagOf } from '../themes.js';
import { validatePuzzle } from '../validate.js';
import { product } from './fixtures.js';
import type { CatalogProduct } from '../types.js';

const YEARS = [1365, 1370, 1375, 1380, 1385, 1390, 1395, 1400];
const CATS = ['food', 'snack', 'drink', 'car', 'electronics'];

/** A synthetic catalog: prices grow with random speed, so rules have real structure to find. */
function catalog(n: number, seed: number): CatalogProduct[] {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, (_, i) => {
    let price = Math.floor(10 ** (1 + rng() * 3)); // 10 .. 10 000 rials
    const prices: Record<number, number> = {};
    for (const y of YEARS) {
      prices[y] = price;
      price = Math.floor(price * (1.5 + rng() * 5));
    }
    return product(`p${i}`, CATS[i % CATS.length] as string, prices, i % 3 === 0 ? ['dahe-60'] : i % 3 === 1 ? ['dahe-70'] : []);
  });
}

describe('generatePuzzle', () => {
  it('is reproducible from a seed', () => {
    const c = catalog(150, 1);
    const a = generatePuzzle(c, mulberry32(7));
    const b = generatePuzzle(c, mulberry32(7));
    expect(a).not.toBeNull();
    expect(a!.groups).toEqual(b!.groups);
  });

  it('always returns a puzzle that passes the validator (exactly one solution) with the required red herrings', () => {
    let made = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const c = catalog(150, seed);
      const out = generatePuzzle(c, mulberry32(seed * 31));
      if (!out) continue;
      made++;
      const used = new Set(out.groups.flatMap((g) => g.productIds));
      expect(used.size).toBe(16);
      expect(out.groups.map((g) => g.level)).toEqual([0, 1, 2, 3]);
      const check = validatePuzzle({ groups: out.groups }, c.filter((p) => used.has(p.id)));
      expect(check.ok).toBe(true);
      expect(check.nearMisses.length).toBeGreaterThanOrEqual(2);
      for (const g of out.groups) expect(g.productIds).toHaveLength(4);
    }
    expect(made).toBe(25); // a catalog of 150 products always works (measured 20/20 at 150; 14/20 at 90, 6/20 at 60)
  });

  it('gives up cleanly (null) on a catalog too small or without data', () => {
    expect(generatePuzzle(catalog(10, 1), mulberry32(1))).toBeNull();
    expect(generatePuzzle(Array.from({ length: 40 }, (_, i) => product(`x${i}`, 'food', {})), mulberry32(1))).toBeNull();
  });

  it('keeps every money value an integer', () => {
    const out = generatePuzzle(catalog(150, 3), mulberry32(5));
    expect(out).not.toBeNull();
    for (const g of out!.groups) {
      const r = g.rule as Record<string, unknown>;
      for (const k of ['min', 'max', 'target', 'threshold']) if (k in r) expect(Number.isInteger(r[k])).toBe(true);
    }
  });
});

describe('explainRule', () => {
  it('says each rule in plain Persian with toman, never raw rials', async () => {
    const { explainRule } = await import('../generate.js');
    expect(explainRule({ kind: 'price_band_at_year', year: 1375, min: 900_000, max: 1_100_000 })).toContain('۱۳۷۵');
    expect(explainRule({ kind: 'multiplier_between', yearA: 1370, yearB: 1400, minX: 80, maxX: 120 })).toContain('برابر');
    expect(explainRule({ kind: 'era_icon', eraTag: 'dahe-60' })).toContain('۶۰');
    expect(explainRule({ kind: 'curated', note: 'x' })).toBeTruthy();
  });
});

describe('generatePuzzle by player level', () => {
  const LEVELS = [1, 6, 12, 20, 30];

  it('makes valid puzzles for every player level, with a wider mix of rule kinds than bands alone', () => {
    for (const level of LEVELS) {
      const kinds = new Set<string>();
      let made = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const c = catalog(150, seed);
        const out = generatePuzzle(c, mulberry32(seed * 17 + level), { playerLevel: level });
        if (!out) continue;
        made++;
        const used = new Set(out.groups.flatMap((g) => g.productIds));
        expect(validatePuzzle({ groups: out.groups }, c.filter((p) => used.has(p.id))).ok).toBe(true);
        expect(out.validation.nearMisses.length).toBeGreaterThanOrEqual(profileForLevel(level).minNearMisses);
        for (const g of out.groups) kinds.add(g.rule.kind);
        const perKind = new Map<string, number>();
        for (const g of out.groups) perKind.set(g.rule.kind, (perKind.get(g.rule.kind) ?? 0) + 1);
        expect(Math.max(...perKind.values())).toBeLessThanOrEqual(2);
      }
      expect(made).toBeGreaterThanOrEqual(10);
      expect(kinds.size).toBeGreaterThanOrEqual(3); // this catalog has no theme tags, so theme groups cannot appear here
    }
  });

  it('gives newcomers looser price bands than veterans, group level for group level', () => {
    const width = (level: number, groupLevel: number) => {
      const ratios: number[] = [];
      for (let seed = 1; seed <= 14; seed++) {
        const out = generatePuzzle(catalog(150, seed), mulberry32(seed + 5), { playerLevel: level });
        for (const g of out?.groups ?? []) if (g.level === groupLevel && g.rule.kind === 'price_band_at_year') ratios.push(g.rule.max / Math.max(1, g.rule.min));
      }
      return ratios.length === 0 ? null : ratios.reduce((x, y) => x + y, 0) / ratios.length;
    };
    let compared = 0;
    for (const gl of [0, 1, 2]) {
      const easy = width(1, gl);
      const hard = width(30, gl);
      if (easy === null || hard === null) continue;
      compared++;
      expect(easy).toBeGreaterThan(hard);
    }
    expect(compared).toBeGreaterThan(0);
  });

  it('keeps newcomers away from the brutal multipliers and first-crossing riddles', () => {
    const count = (level: number, kind: string) => {
      let n = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const out = generatePuzzle(catalog(150, seed), mulberry32(seed + 9), { playerLevel: level });
        n += (out?.groups ?? []).filter((g) => g.rule.kind === kind).length;
      }
      return n;
    };
    expect(count(1, 'multiplier_between')).toBe(0);
    expect(count(1, 'first_crossed')).toBe(0);
    expect(count(30, 'multiplier_between') + count(30, 'first_crossed')).toBeGreaterThan(0);
  });

  it('is still reproducible from a seed at a given level', () => {
    const c = catalog(150, 4);
    expect(generatePuzzle(c, mulberry32(3), { playerLevel: 22 })!.groups).toEqual(generatePuzzle(c, mulberry32(3), { playerLevel: 22 })!.groups);
  });
});

describe('draftTitle', () => {
  it('varies by seed, always contains the plain rule, and never throws for any kind', () => {
    const c = catalog(150, 2);
    const titles = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const out = generatePuzzle(c, mulberry32(seed), { playerLevel: 15 });
      for (const g of out?.groups ?? []) {
        const t = draftTitle(g.rule, mulberry32(seed + 100));
        expect(t).toContain(explainRule(g.rule));
        expect(t.length).toBeLessThanOrEqual(100 + 40);
        titles.add(t.split(/[؛:]/)[0] as string);
      }
    }
    expect(titles.size).toBeGreaterThanOrEqual(8);
  });
});

describe('theme groups', () => {
  /** The synthetic catalog, with 6 of the 17 themes hand-tagged on disjoint product slices. */
  function themed(seed: number): CatalogProduct[] {
    return catalog(150, seed).map((p, i) => {
      const slot = Math.floor(i / 7);
      const theme = slot < 6 ? THEMES[slot]!.key : null;
      return theme ? { ...p, eraTags: [...p.eraTags, themeTagOf(theme)] } : p;
    });
  }

  it('builds theme groups that stay valid and unique, and uses several different themes', () => {
    const seen = new Set<string>();
    let made = 0;
    for (let seed = 1; seed <= 16; seed++) {
      const c = themed(seed);
      const out = generatePuzzle(c, mulberry32(seed * 13), { playerLevel: 2 });
      if (!out) continue;
      made++;
      const used = new Set(out.groups.flatMap((g) => g.productIds));
      expect(validatePuzzle({ groups: out.groups }, c.filter((p) => used.has(p.id))).ok).toBe(true);
      for (const g of out.groups) if (g.rule.kind === 'theme_tag') seen.add(g.rule.theme);
    }
    expect(made).toBeGreaterThanOrEqual(12);
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('does not build a theme from a tag only 3 products carry, and never mistakes a theme tag for an era', () => {
    const c = catalog(150, 1).map((p, i) => (i < 3 ? { ...p, eraTags: [themeTagOf('kitchen')] } : p));
    for (let seed = 1; seed <= 10; seed++) {
      const out = generatePuzzle(c, mulberry32(seed), { playerLevel: 2 });
      for (const g of out?.groups ?? []) {
        expect(g.rule.kind === 'theme_tag').toBe(false);
        if (g.rule.kind === 'era_icon') expect(g.rule.eraTag.startsWith('theme:')).toBe(false);
      }
    }
  });

  it('writes the theme title and the plain explanation in Persian', () => {
    const rule = { kind: 'theme_tag' as const, theme: 'storeroom' };
    expect(explainRule(rule)).toBe('همه‌شان گوشه‌ی انباری خاک می‌خوردند');
    expect(THEMES.find((t) => t.key === 'storeroom')!.titlesFa).toContain(draftTitle(rule, mulberry32(1)));
  });
});
