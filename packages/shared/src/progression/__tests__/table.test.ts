import { describe, expect, it } from 'vitest';
import { checkLevelTable, defaultLevelTable, levelInfo, startsOf } from '../index.js';

describe('level table', () => {
  it('the default table is the formula: curve starts and the every-Nth-level coins', () => {
    const t = defaultLevelTable({ curveBase: 50, levelMax: 10 }, { every: 5, base: 25 });
    expect(t).toHaveLength(10);
    expect(t.slice(0, 3).map((r) => r.startXp)).toEqual([0, 50, 200]);
    expect(t.filter((r) => r.rewardCoins > 0).map((r) => [r.level, r.rewardCoins])).toEqual([[5, 25], [10, 50]]);
    expect(checkLevelTable(t)).toBeNull();
  });

  it('refuses gaps, a non-zero start, flat or falling XP, an empty or huge table', () => {
    const ok = [{ level: 1, startXp: 0, rewardCoins: 0 }, { level: 2, startXp: 100, rewardCoins: 10 }];
    expect(checkLevelTable(ok)).toBeNull();
    expect(checkLevelTable([])).toBe('empty');
    expect(checkLevelTable([{ level: 2, startXp: 0, rewardCoins: 0 }])).toBe('not_contiguous');
    expect(checkLevelTable([{ level: 1, startXp: 5, rewardCoins: 0 }])).toBe('first_not_zero');
    expect(checkLevelTable([...ok, { level: 3, startXp: 100, rewardCoins: 0 }])).toBe('not_increasing');
    expect(checkLevelTable(Array.from({ length: 101 }, (_, i) => ({ level: i + 1, startXp: i, rewardCoins: 0 })))).toBe('too_long');
    expect(checkLevelTable([{ level: 1, startXp: 0, rewardCoins: 2_000_000 }])).toBe('reward_too_big');
  });

  it('levelInfo follows the table instead of the curve, and the table length is the cap', () => {
    const starts = startsOf([{ level: 1, startXp: 0, rewardCoins: 0 }, { level: 2, startXp: 30, rewardCoins: 0 }, { level: 3, startXp: 100, rewardCoins: 0 }]);
    const rules = { curveBase: 50, levelMax: 50, starts };
    expect(levelInfo(29, rules)).toEqual({ level: 1, xp: 29, xpInLevel: 29, xpForNext: 30 });
    expect(levelInfo(30, rules)).toMatchObject({ level: 2, xpInLevel: 0, xpForNext: 70 });
    expect(levelInfo(100000, rules)).toEqual({ level: 3, xp: 100000, xpInLevel: 0, xpForNext: 0 });
    // without a table the curve still rules
    expect(levelInfo(50, { curveBase: 50, levelMax: 50 }).level).toBe(2);
  });
});
