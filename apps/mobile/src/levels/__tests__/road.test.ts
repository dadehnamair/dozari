import { describe, expect, it } from 'vitest';
import { claimableCoins, levelProgress, roadNodes, xpToReach } from '../road';

const unlocks = [
  { level: 2, kind: 'hint' as const, titleFa: null, iconKey: null },
  { level: 5, kind: 'invite' as const, titleFa: null, iconKey: null },
  { level: 5, kind: 'shop' as const, titleFa: 'بسته', iconKey: 'potion' },
];

describe('level road', () => {
  it('lists levelMax…1 with done / current / locked and the unlocks of each level', () => {
    const nodes = roadNodes({ level: 3, levelMax: 6, unlocks });
    expect(nodes.map((n) => [n.level, n.state])).toEqual([[6, 'locked'], [5, 'locked'], [4, 'locked'], [3, 'current'], [2, 'done'], [1, 'done']]);
    expect(nodes.find((n) => n.level === 5)?.unlocks.map((u) => u.kind)).toEqual(['invite', 'shop']);
    expect(nodes.find((n) => n.level === 4)?.unlocks).toEqual([]);
  });

  it('progress is a clamped fraction, full at the cap', () => {
    expect(levelProgress({ xpInLevel: 70, xpForNext: 140 })).toBe(0.5);
    expect(levelProgress({ xpInLevel: 0, xpForNext: 0 })).toBe(1);
    expect(levelProgress({ xpInLevel: 999, xpForNext: 10 })).toBe(1);
  });

  it('xp to reach a level follows the curve base·(level-1)²', () => {
    expect(xpToReach({ xp: 220, curveBase: 50 }, 5)).toBe(50 * 16 - 220);
    expect(xpToReach({ xp: 220, curveBase: 50 }, 2)).toBe(0);
  });

  it('xp to reach a level follows the admin table when the road carries one', () => {
    expect(xpToReach({ xp: 100, curveBase: 50, starts: [0, 40, 120] }, 3)).toBe(20);
    expect(xpToReach({ xp: 100, curveBase: 50, starts: [0, 40, 120] }, 2)).toBe(0);
  });

  it('puts the coin reward on its level and sums what can be taken', () => {
    const rewards = [{ level: 2, coins: 25, claimed: true }, { level: 3, coins: 50, claimed: false }, { level: 5, coins: 75, claimed: false }];
    const nodes = roadNodes({ level: 3, levelMax: 6, unlocks, rewards });
    expect(nodes.find((n) => n.level === 3)?.reward).toEqual({ coins: 50, claimed: false });
    expect(nodes.find((n) => n.level === 4)?.reward).toBeNull();
    expect(claimableCoins({ level: 3, rewards })).toBe(50);
  });
});
