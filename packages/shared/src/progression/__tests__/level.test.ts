import { describe, expect, it } from 'vitest';
import { levelInfo, xpForGame } from '../level.js';

const rules = { curveBase: 50, levelMax: 50 };

describe('levelInfo', () => {
  it('starts at level 1 and levels up at 50, 200, 450 XP', () => {
    expect(levelInfo(0, rules)).toEqual({ level: 1, xp: 0, xpInLevel: 0, xpForNext: 50 });
    expect(levelInfo(49, rules).level).toBe(1);
    expect(levelInfo(50, rules)).toMatchObject({ level: 2, xpInLevel: 0, xpForNext: 150 });
    expect(levelInfo(199, rules).level).toBe(2);
    expect(levelInfo(200, rules).level).toBe(3);
    expect(levelInfo(450, rules).level).toBe(4);
  });
  it('stops at the cap and survives bad input', () => {
    expect(levelInfo(10_000_000, rules)).toEqual({ level: 50, xp: 10_000_000, xpInLevel: 0, xpForNext: 0 });
    expect(levelInfo(-5, rules).level).toBe(1);
    expect(levelInfo(12.9, rules).xp).toBe(12);
  });
});

describe('xpForGame', () => {
  const r = { soloBase: 5, duelBase: 10, winBonus: 15 };
  it('pays the base for a finished game and the bonus for a win', () => {
    expect(xpForGame({ mode: 'solo', outcome: 'loss' }, r)).toBe(5);
    expect(xpForGame({ mode: 'solo', outcome: 'win' }, r)).toBe(20);
    expect(xpForGame({ mode: 'duel', outcome: 'draw' }, r)).toBe(10);
    expect(xpForGame({ mode: 'duel', outcome: 'win' }, r)).toBe(25);
  });
});
