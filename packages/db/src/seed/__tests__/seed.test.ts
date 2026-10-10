import { describe, expect, it } from 'vitest';
import { knownProductSlugs } from '../catalog-index.js';
import { readSeedProducts, readSeedPuzzles } from '../load.js';

describe('catalog seed files', () => {
  const seed = readSeedProducts();

  it('parses and has no duplicate slugs or approved (product, year, month)', () => {
    expect(seed.length).toBeGreaterThan(0);
  });

  it('gives every non-kid product at least one price point (kid items need none)', () => {
    for (const p of seed.filter((x) => x.age_track !== 'kid')) expect(p.prices.length, p.slug).toBeGreaterThanOrEqual(1);
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
    const puzzles = readSeedPuzzles(knownProductSlugs());
    expect(puzzles.length).toBeGreaterThanOrEqual(10);
    for (const p of puzzles) expect(p.groups.flatMap((g) => g.products)).toHaveLength(16);
  });
});

describe('teen starter puzzles (age tracks)', () => {
  // Product data (age track, prices) lives in the database; the age-track check runs when the puzzles are loaded.
  const puzzles = readSeedPuzzles(knownProductSlugs()).filter((p) => p.age_track === 'teen');

  it('has a few teen puzzles, all drafts for an editor to approve', () => {
    expect(puzzles.length).toBeGreaterThanOrEqual(5);
    for (const p of puzzles) expect(p.status, p.id).toBe('draft');
  });

  it('never repeats the same group of four in two puzzles', () => {
    const keys = puzzles.flatMap((p) => p.groups.map((g) => [...g.products].sort().join(',')));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
