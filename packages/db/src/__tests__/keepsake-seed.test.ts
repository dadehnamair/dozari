import { describe, expect, it } from 'vitest';
import { checkSeedKeepsakes } from '@dozari/shared';
import { readSeedKeepsakes } from '../seed/keepsakes.js';

describe('keepsake seed', () => {
  const files = readSeedKeepsakes();
  const all = files.flatMap((f) => f.keepsakes);
  it("is the designer's first series: eight cards, each with its art key", () => {
    expect(all).toHaveLength(8);
    expect(all.map((k) => k.art_key).sort()).toEqual(Array.from({ length: 8 }, (_, i) => `yadegar-${i + 1}`));
    expect(checkSeedKeepsakes(files, new Set())).toEqual([]);
  });
  it('puts every keepsake in a set and gives each set at least two keepsakes', () => {
    const sets = new Map<string, number>();
    for (const k of all) {
      expect(k.set).not.toBeNull();
      sets.set(k.set!, (sets.get(k.set!) ?? 0) + 1);
    }
    for (const n of sets.values()) expect(n).toBeGreaterThanOrEqual(2);
  });
  it('has four pieces for a common card and six for a rare one (the designer\'s frames)', () => {
    for (const k of all) expect(k.pieces).toBe(k.rarity === 'rare' ? 6 : 4);
    expect(all.filter((k) => k.rarity === 'rare')).toHaveLength(4);
  });
  it('retires the earlier product-based starters it replaces', () => {
    const retire = files.flatMap((f) => f.retire_titles ?? []);
    expect(retire).toHaveLength(18);
    for (const k of all) expect(retire).not.toContain(k.title_fa);
  });
  it('flags a duplicate title or an unknown product', () => {
    const first = files[0]!;
    const dup = { ...first, keepsakes: [...first.keepsakes, { ...first.keepsakes[0]!, key: 'other-key', product_slug: 'no-such-product' }] };
    expect(checkSeedKeepsakes([dup], new Set()).length).toBeGreaterThanOrEqual(2);
  });
});
