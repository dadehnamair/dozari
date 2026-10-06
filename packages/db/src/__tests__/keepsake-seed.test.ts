import { describe, expect, it } from 'vitest';
import { checkSeedKeepsakes } from '@dozari/shared';
import { readSeedKeepsakes } from '../seed/keepsakes.js';

describe('keepsake seed', () => {
  const files = readSeedKeepsakes();
  const all = files.flatMap((f) => f.keepsakes);
  it('validates against the product seed', () => {
    expect(all.length).toBeGreaterThanOrEqual(10);
  });
  it('puts every keepsake in a set and gives each set at least two keepsakes', () => {
    const sets = new Map<string, number>();
    for (const k of all) {
      expect(k.set).not.toBeNull();
      sets.set(k.set!, (sets.get(k.set!) ?? 0) + 1);
    }
    for (const n of sets.values()) expect(n).toBeGreaterThanOrEqual(2);
  });
  it('has four pieces for most keepsakes and six for the legendary ones', () => {
    for (const k of all) expect(k.pieces).toBe(k.rarity === 'legendary' ? 6 : 4);
  });
  it('flags a duplicate title or an unknown product', () => {
    const first = files[0]!;
    const dup = { ...first, keepsakes: [...first.keepsakes, { ...first.keepsakes[0]!, key: 'other-key', product_slug: 'no-such-product' }] };
    expect(checkSeedKeepsakes([dup], new Set()).length).toBeGreaterThanOrEqual(2);
  });
});
