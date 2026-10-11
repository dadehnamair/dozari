import { describe, expect, it } from 'vitest';
import { groupHoldsGem, mulberry32, rollGemCard } from '../index.js';

const ids = Array.from({ length: 16 }, (_, i) => `p${i}`);

describe('rollGemCard', () => {
  it('never hides a gem at 0 percent and always does at 100', () => {
    for (let s = 1; s < 50; s++) {
      expect(rollGemCard(ids, 0, mulberry32(s))).toBeNull();
      expect(ids).toContain(rollGemCard(ids, 100, mulberry32(s)));
    }
  });
  it('is deterministic for a seed and roughly follows the percentage', () => {
    expect(rollGemCard(ids, 50, mulberry32(7))).toBe(rollGemCard(ids, 50, mulberry32(7)));
    let hits = 0;
    for (let s = 1; s <= 2000; s++) if (rollGemCard(ids, 5, mulberry32(s))) hits++;
    expect(hits).toBeGreaterThan(40);
    expect(hits).toBeLessThan(180);
  });
  it('has nothing to hide on an empty board', () => {
    expect(rollGemCard([], 100, mulberry32(1))).toBeNull();
  });
});

describe('groupHoldsGem', () => {
  it('matches only the group with the gem card', () => {
    expect(groupHoldsGem('p1', ['p0', 'p1', 'p2', 'p3'])).toBe(true);
    expect(groupHoldsGem('p9', ['p0', 'p1', 'p2', 'p3'])).toBe(false);
    expect(groupHoldsGem(null, ['p0'])).toBe(false);
  });
});
