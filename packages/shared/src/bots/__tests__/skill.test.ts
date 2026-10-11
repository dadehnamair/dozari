import { describe, expect, it } from 'vitest';
import { BOT_ACCURACY_MAX_PERCENT, BOT_ACCURACY_MIN_PERCENT, BOT_SKILL_BANDS } from '../../config/botSkill.js';
import { mulberry32 } from '../../game/rng.js';
import { chooseBotMove, chooseBotPriceGuess } from '../move.js';
import { botSkillForLevel, scaledThinkRange } from '../skill.js';

const groups = [['a1', 'a2', 'a3', 'a4'], ['b1', 'b2', 'b3', 'b4'], ['c1', 'c2', 'c3', 'c4'], ['d1', 'd2', 'd3', 'd4']];
const remaining = groups.flat();

describe('botSkillForLevel', () => {
  it('picks the band of the level and is monotone: higher level = more accurate, faster, tighter price', () => {
    const levels = [1, 3, 4, 8, 9, 15, 16, 25, 26, 50];
    const ps = levels.map((l) => botSkillForLevel(l));
    expect(ps.map((p) => p.band)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
    for (let i = 1; i < ps.length; i++) {
      expect(ps[i]!.accuracyPercent).toBeGreaterThanOrEqual(ps[i - 1]!.accuracyPercent);
      expect(ps[i]!.thinkScalePercent).toBeLessThanOrEqual(ps[i - 1]!.thinkScalePercent);
      expect(ps[i]!.priceMaxErrorPercent).toBeLessThanOrEqual(ps[i - 1]!.priceMaxErrorPercent);
    }
  });

  it('the per-bot skill nudges within bounds and bad levels fall to band 0', () => {
    expect(botSkillForLevel(10, 100).accuracyPercent).toBeGreaterThan(botSkillForLevel(10, 0).accuracyPercent);
    expect(botSkillForLevel(100, 100).accuracyPercent).toBeLessThanOrEqual(BOT_ACCURACY_MAX_PERCENT);
    expect(botSkillForLevel(1, 0).accuracyPercent).toBeGreaterThanOrEqual(BOT_ACCURACY_MIN_PERCENT);
    expect(botSkillForLevel(Number.NaN).band).toBe(0);
    expect(botSkillForLevel(-4).band).toBe(0);
    expect(BOT_SKILL_BANDS.map((b) => b.minLevel)).toEqual([...BOT_SKILL_BANDS.map((b) => b.minLevel)].sort((a, b) => a - b));
  });

  it('scales the think range', () => {
    expect(scaledThinkRange(1000, 2000, { thinkScalePercent: 150 })).toEqual({ minMs: 1500, maxMs: 3000 });
  });
});

describe('level-driven play', () => {
  const rate = (level: number): number => {
    const rng = mulberry32(11);
    const p = botSkillForLevel(level);
    let hit = 0;
    for (let i = 0; i < 2000; i++) {
      const m = chooseBotMove({ groups, remaining, skill: 50, accuracyPercent: p.accuracyPercent, nearMissPercent: p.nearMissPercent, rng });
      if (groups.some((g) => g.every((c) => m.includes(c)))) hit++;
    }
    return hit / 2000;
  };

  it('a high-level bot finds real groups clearly more often than a low-level one', () => {
    expect(rate(1)).toBeLessThan(0.4);
    expect(rate(30)).toBeGreaterThan(0.75);
    expect(rate(30)).toBeGreaterThan(rate(10));
    expect(rate(10)).toBeGreaterThan(rate(1));
  });

  it('price guess error follows the level and stays deterministic per seed', () => {
    const err = (level: number) => {
      const rng = mulberry32(3);
      const max = botSkillForLevel(level).priceMaxErrorPercent;
      let worst = 0;
      for (let i = 0; i < 500; i++) worst = Math.max(worst, Math.abs(Number(chooseBotPriceGuess({ actualRials: 1_000_000n, skill: 50, maxErrorPercent: max, rng })) / 1_000_000 - 1));
      return { worst, max };
    };
    const low = err(1);
    const high = err(40);
    expect(low.worst).toBeLessThanOrEqual(low.max / 100 + 1e-9);
    expect(high.worst).toBeLessThanOrEqual(high.max / 100 + 1e-9);
    expect(high.worst).toBeLessThan(low.worst);
    const a = chooseBotPriceGuess({ actualRials: 5000n, skill: 50, maxErrorPercent: 30, rng: mulberry32(9) });
    expect(a).toBe(chooseBotPriceGuess({ actualRials: 5000n, skill: 50, maxErrorPercent: 30, rng: mulberry32(9) }));
  });
});
