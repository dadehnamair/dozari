import { catalogFromSeed, seedRuleToRule, validatePuzzle } from '@dozari/shared';
import { describe, expect, it } from 'vitest';
import { readSeedProducts, readSeedPuzzles } from '../load.js';

describe('catalog seed files', () => {
  const seed = readSeedProducts();

  it('parses and has no duplicate slugs or approved (product, year, month)', () => {
    expect(seed.length).toBeGreaterThan(0);
  });

  it('gives every product at least one price point', () => {
    for (const p of seed) expect(p.prices.length, p.slug).toBeGreaterThanOrEqual(1);
  });

  it('keeps one unit per product and flags year-over-year drops above 30%', () => {
    for (const p of seed) {
      const approved = p.prices
        .filter((pt) => pt.status === 'approved')
        .map((pt) => ({ year: pt.year, rials: Number(pt.rials ?? (pt.toman as number) * 10) }))
        .sort((a, b) => a.year - b.year);
      for (let i = 1; i < approved.length; i++) {
        const prev = approved[i - 1]!;
        const cur = approved[i]!;
        expect(cur.rials, `${p.slug} ${prev.year}->${cur.year}`).toBeGreaterThanOrEqual(
          prev.rials * 0.7,
        );
      }
    }
  });
});

describe('product icons', () => {
  it('gives every product an emoji icon (no photos exist yet)', () => {
    for (const p of readSeedProducts()) expect(p.icon, p.slug).toBeTruthy();
  });
});

describe('puzzle seed files', () => {
  const products = readSeedProducts();
  const puzzles = readSeedPuzzles(products);

  it('parses, references only seeded products and has 4 levelled groups × 4 items', () => {
    expect(puzzles.length).toBeGreaterThan(0);
    for (const pz of puzzles) {
      expect(pz.groups.map((g) => g.level).sort(), pz.slug).toEqual([0, 1, 2, 3]);
      expect(new Set(pz.groups.flatMap((g) => g.items)).size, pz.slug).toBe(16);
    }
  });

  it('only uses products that have price points for years its rules reference', () => {
    const years = new Map(products.map((p) => [p.slug, new Set(p.prices.map((x) => x.year))]));
    for (const pz of puzzles) {
      for (const g of pz.groups) {
        const r = g.rule;
        const needed =
          r.kind === 'price_band_at_year' || r.kind === 'same_price_at_year'
            ? [r.year]
            : r.kind === 'multiplier_between'
              ? [r.year_a, r.year_b]
              : [];
        for (const slug of g.items) {
          for (const y of needed)
            expect(years.get(slug)?.has(y), `${pz.slug} ${slug} ${y}`).toBe(true);
        }
      }
    }
  });

  it('passes validatePuzzle hard checks (pending prices included, see D64)', () => {
    const catalog = catalogFromSeed(products, { includePending: true });
    for (const pz of puzzles) {
      const draft = {
        groups: pz.groups.map((g) => ({
          level: g.level,
          rule: seedRuleToRule(g.rule),
          items: g.items,
        })),
      };
      const r = validatePuzzle(draft, catalog);
      expect(r.errors, pz.slug).toEqual([]);
    }
  });

  it('is not servable yet: no approved prices means approved-only validation fails', () => {
    const catalog = catalogFromSeed(products);
    const pz = puzzles[0]!;
    const draft = {
      groups: pz.groups.map((g) => ({
        level: g.level,
        rule: seedRuleToRule(g.rule),
        items: g.items,
      })),
    };
    expect(validatePuzzle(draft, catalog).ok).toBe(false);
  });
});
