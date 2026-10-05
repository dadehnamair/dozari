import { describe, expect, it } from 'vitest';
import { checkSeedProducts, checkSeedPuzzles, seedPriceToRials, seedProductSchema } from '../catalog.js';
import type { SeedPuzzle } from '../catalog.js';

const base = {
  slug: 'nooshabe-kola',
  name_fa: 'نوشابه',
  category: 'drink',
  prices: [{ year: 1375, toman: 50, source_type: 'user_memory', confidence: 1 }],
};

describe('seedProductSchema', () => {
  it('accepts a minimal product and applies defaults', () => {
    const p = seedProductSchema.parse(base);
    expect(p.status).toBe('in_production');
    expect(p.prices[0]?.status).toBe('approved');
  });

  it('requires exactly one price unit', () => {
    const both = { ...base, prices: [{ ...base.prices[0], rials: 500 }] };
    expect(seedProductSchema.safeParse(both).success).toBe(false);
    const none = { ...base, prices: [{ year: 1375, source_type: 'other', confidence: 2 }] };
    expect(seedProductSchema.safeParse(none).success).toBe(false);
  });

  it('rejects fractional rials and non-1 confidence for user_memory', () => {
    const frac = { ...base, prices: [{ ...base.prices[0], toman: 0.05 }] };
    expect(seedProductSchema.safeParse(frac).success).toBe(false);
    const conf = { ...base, prices: [{ ...base.prices[0], confidence: 3 }] };
    expect(seedProductSchema.safeParse(conf).success).toBe(false);
  });

  it('allows half-toman prices (5 rials)', () => {
    const half = seedProductSchema.parse({ ...base, prices: [{ ...base.prices[0], toman: 0.5 }] });
    expect(seedPriceToRials(half.prices[0]!)).toBe(5n);
  });

  it('rejects bad slugs and products without prices', () => {
    expect(seedProductSchema.safeParse({ ...base, slug: 'Bad Slug' }).success).toBe(false);
    expect(seedProductSchema.safeParse({ ...base, prices: [] }).success).toBe(false);
  });
});

describe('checkSeedProducts', () => {
  it('flags duplicate slugs and duplicate approved (year, month)', () => {
    const p = seedProductSchema.parse({
      ...base,
      prices: [base.prices[0], { ...base.prices[0], toman: 60 }],
    });
    const errors = checkSeedProducts([p, p]);
    expect(errors.some((e) => e.includes('duplicate slug'))).toBe(true);
    expect(errors.some((e) => e.includes('duplicate approved price'))).toBe(true);
  });

  it('allows a pending price next to an approved one for the same year', () => {
    const p = seedProductSchema.parse({
      ...base,
      prices: [base.prices[0], { ...base.prices[0], toman: 60, status: 'pending' }],
    });
    expect(checkSeedProducts([p])).toEqual([]);
  });
});

describe('kid items and puzzles (D198)', () => {
  const kidItem = { slug: 'kid-apple', name_fa: 'سیب', category: 'food', age_track: 'kid', lesson: { word_fa: 'سیب', story_fa: 'میوه' } };
  it('lets a kid item have no price and a lesson, but not an adult one', () => {
    expect(seedProductSchema.safeParse(kidItem).success).toBe(true);
    expect(seedProductSchema.safeParse({ ...kidItem, age_track: 'adult' }).success).toBe(false);
    expect(seedProductSchema.safeParse({ slug: 'plain', name_fa: 'x', category: 'food' }).success).toBe(false);
  });
  const puzzle = (track: 'kid' | 'adult'): SeedPuzzle => ({
    id: 'p1',
    age_track: track,
    status: 'draft',
    groups: [0, 1, 2, 3].map((level) => ({ level, title_fa: 'گروه', explanation_fa: 'توضیح', products: [0, 1, 2, 3].map((i) => `s${level * 4 + i}`) })),
  });
  const slugs = new Set(Array.from({ length: 16 }, (_, i) => `s${i}`));
  it('keeps adult items out of a kid puzzle', () => {
    expect(checkSeedPuzzles([puzzle('kid')], slugs)).toHaveLength(16);
    const tracks = new Map(Array.from({ length: 16 }, (_, i) => [`s${i}`, 'kid'] as const));
    expect(checkSeedPuzzles([puzzle('kid')], slugs, tracks)).toEqual([]);
    expect(checkSeedPuzzles([puzzle('adult')], slugs)).toEqual([]);
  });
});
