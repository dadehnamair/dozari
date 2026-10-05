import { describe, expect, it } from 'vitest';
import { DEFAULT_PUZZLE_TIERS, tierProblem, tiersForLevel } from '../tiers.js';
import type { PuzzleTier } from '../tiers.js';

const tiers: PuzzleTier[] = DEFAULT_PUZZLE_TIERS.map((t, i) => ({ ...t, id: `t${i}` }));

describe('tiersForLevel', () => {
  it('serves the easiest tier to a level-1 player and the hardest to a veteran', () => {
    expect(tiersForLevel(tiers, 1).map((t) => t.nameFa)).toEqual(['خیلی آسان']);
    expect(tiersForLevel(tiers, 99).map((t) => t.nameFa)).toEqual(['خیلی سخت']);
  });

  it('includes every tier whose range holds the level, easiest first', () => {
    const wide: PuzzleTier[] = [
      { id: 'b', nameFa: 'بالا', sortOrder: 2, minLevel: 3, maxLevel: null },
      { id: 'a', nameFa: 'پایین', sortOrder: 1, minLevel: 1, maxLevel: 5 },
    ];
    expect(tiersForLevel(wide, 4).map((t) => t.id)).toEqual(['a', 'b']);
    expect(tiersForLevel(wide, 6).map((t) => t.id)).toEqual(['b']);
  });

  it('returns nothing when no tier covers the level', () => {
    expect(tiersForLevel([{ id: 'x', nameFa: 'ایکس', sortOrder: 1, minLevel: 10, maxLevel: 12 }], 3)).toEqual([]);
  });
});

describe('tierProblem', () => {
  it('accepts sane tiers and flags bad names and ranges', () => {
    expect(tierProblem({ nameFa: 'آسان', minLevel: 1, maxLevel: null })).toBeNull();
    expect(tierProblem({ nameFa: ' ', minLevel: 1, maxLevel: 3 })).toBe('name');
    expect(tierProblem({ nameFa: 'آسان', minLevel: 0, maxLevel: 3 })).toBe('level_range');
    expect(tierProblem({ nameFa: 'آسان', minLevel: 5, maxLevel: 3 })).toBe('level_range');
  });

  it('ships defaults that cover every level once', () => {
    for (const level of [1, 3, 4, 8, 9, 15, 16, 25, 26, 100]) expect(tiersForLevel(tiers, level)).toHaveLength(1);
    expect(DEFAULT_PUZZLE_TIERS.every((t) => tierProblem(t) === null)).toBe(true);
  });
});
