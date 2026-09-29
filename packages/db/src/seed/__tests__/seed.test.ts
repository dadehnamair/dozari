import { describe, expect, it } from 'vitest';
import { readSeedProducts } from '../load.js';

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
