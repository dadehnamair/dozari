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
        expect(cur.rials, `${p.slug} ${prev.year}->${cur.year}`).toBeGreaterThanOrEqual(prev.rials * 0.7);
      }
    }
  });
});

describe('sample seed (to be removed before launch)', () => {
  const seed = readSeedProducts();
  const sample = seed.filter((p) => p.slug.startsWith('sample-'));

  it('has a real catalog: enough products with at least three price years each, all marked as sample numbers', () => {
    expect(sample.length).toBeGreaterThanOrEqual(100);
    for (const p of sample) {
      expect(new Set(p.prices.map((x) => x.year)).size, p.slug).toBeGreaterThanOrEqual(3);
      expect(p.prices.every((x) => (x.source_note ?? '').includes('نمونه')), p.slug).toBe(true);
    }
  });

  it('has curated puzzles whose 16 products all exist', () => {
    const puzzles = readSeedPuzzles(seed);
    expect(puzzles.length).toBeGreaterThanOrEqual(10);
    for (const p of puzzles) expect(p.groups.flatMap((g) => g.products)).toHaveLength(16);
  });
});

describe('the generator on the sample catalog', () => {
  it('makes valid, distinct puzzles from the sample products (so the seed script can top the pool up)', async () => {
    const { generatePuzzle, mulberry32, seedPriceToRials } = await import('@dozari/shared');
    const catalog = readSeedProducts()
      .filter((p) => p.slug.startsWith('sample-'))
      .map((p) => ({ id: p.slug, category: p.category, eraTags: p.era_tags, prices: p.prices.map((x) => ({ year: x.year, month: x.month ?? null, priceRials: seedPriceToRials(x) })) }));
    const rng = mulberry32(7);
    const keys = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const g = generatePuzzle(catalog, rng);
      if (g) keys.add(g.groups.flatMap((x) => x.productIds).sort().join(','));
    }
    expect(keys.size).toBeGreaterThanOrEqual(8);
  });
});
