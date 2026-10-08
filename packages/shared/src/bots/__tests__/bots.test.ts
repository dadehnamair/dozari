import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../game/rng.js';
import { levelInfo } from '../../progression/level.js';
import { BOT_NAME_POOL, pickBotNames } from '../names.js';
import { plausibleStats } from '../stats.js';
import { botThinkDelay, chooseBotMove } from '../move.js';

const groups = [['a1', 'a2', 'a3', 'a4'], ['b1', 'b2', 'b3', 'b4'], ['c1', 'c2', 'c3', 'c4'], ['d1', 'd2', 'd3', 'd4']];
const remaining = groups.flat();

describe('chooseBotMove', () => {
  it('always returns four distinct cards from the board', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 200; i++) {
      const m = chooseBotMove({ groups, remaining, skill: (i * 7) % 101, rng });
      expect(m).toHaveLength(4);
      expect(new Set(m).size).toBe(4);
      expect(m.every((c) => remaining.includes(c))).toBe(true);
    }
  });
  it('finds real groups about as often as its skill says, and never perfectly', () => {
    const rng = mulberry32(11);
    const rate = (skill: number) => {
      let hit = 0;
      for (let i = 0; i < 2000; i++) {
        const m = chooseBotMove({ groups, remaining, skill, rng });
        if (groups.some((g) => g.every((c) => m.includes(c)))) hit++;
      }
      return hit / 2000;
    };
    expect(rate(0)).toBeLessThan(0.02);
    expect(rate(50)).toBeGreaterThan(0.4);
    expect(rate(50)).toBeLessThan(0.62);
    expect(rate(100)).toBeLessThan(0.97); // capped at 90 %, plus lucky guesses
    expect(rate(100)).toBeGreaterThan(0.85);
  });
  it('sometimes is "one away": three of a group and an intruder', () => {
    const rng = mulberry32(3);
    let oneAway = 0;
    for (let i = 0; i < 1000; i++) {
      const m = chooseBotMove({ groups, remaining, skill: 20, rng });
      if (groups.some((g) => g.filter((c) => m.includes(c)).length === 3)) oneAway++;
    }
    expect(oneAway).toBeGreaterThan(100);
  });
  it('copes with a board where no group is left to find', () => {
    expect(chooseBotMove({ groups: [], remaining: ['x', 'y', 'z', 'w', 'v'], skill: 90, rng: mulberry32(1) })).toHaveLength(4);
  });
});

describe('botThinkDelay', () => {
  it('stays in range and leaves room before the turn ends', () => {
    const rng = mulberry32(2);
    for (let i = 0; i < 100; i++) {
      const d = botThinkDelay(3000, 9000, 60_000, rng);
      expect(d).toBeGreaterThanOrEqual(3000);
      expect(d).toBeLessThanOrEqual(9000);
    }
    expect(botThinkDelay(3000, 9000, 4000, rng)).toBe(1500);
    expect(botThinkDelay(3000, 9000, 1000, rng)).toBe(0);
  });
});

describe('plausibleStats', () => {
  it('fits the level, with a believable record', () => {
    const rng = mulberry32(8);
    for (const level of [1, 3, 8, 20]) {
      const s = plausibleStats({ level, winPercent: 55, curveBase: 50, avgXpPerGame: 15 }, rng);
      expect(levelInfo(s.xp, { curveBase: 50, levelMax: 50 }).level).toBe(level);
      expect(s.wins + s.losses + s.draws).toBe(s.games);
      expect(s.wins / Math.max(1, s.games)).toBeLessThan(0.7);
    }
    expect(plausibleStats({ level: 1, winPercent: 55, curveBase: 50, avgXpPerGame: 15 }, rng).games).toBeLessThan(5);
  });
  it('clamps absurd win rates', () => {
    const s = plausibleStats({ level: 10, winPercent: 100, curveBase: 50, avgXpPerGame: 15 }, mulberry32(1));
    expect(s.wins / s.games).toBeLessThanOrEqual(0.86);
  });
});

describe('pickBotNames', () => {
  it('gives distinct names and skips taken ones', () => {
    const names = pickBotNames(30, new Set([BOT_NAME_POOL[0]!]), mulberry32(4));
    expect(new Set(names).size).toBe(30);
    expect(names).not.toContain(BOT_NAME_POOL[0]);
    expect(pickBotNames(1000, new Set(), mulberry32(4)).length).toBe(BOT_NAME_POOL.length);
  });
});

describe('BOT_NAME_POOL size', () => {
  it('holds enough distinct names for a roster of several hundred bots', () => {
    expect(new Set(BOT_NAME_POOL).size).toBe(BOT_NAME_POOL.length);
    expect(BOT_NAME_POOL.length).toBeGreaterThanOrEqual(400);
  });
});
