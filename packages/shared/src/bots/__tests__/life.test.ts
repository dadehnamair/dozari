import { describe, expect, it } from 'vitest';
import { BOT_SKILL_DRIFT_MAX, BOT_SKILL_DRIFT_MIN } from '../../config/botSkill.js';
import { mulberry32 } from '../../game/rng.js';
import { changesAvatar, driftSkill, scaledByActivity, tehranHour } from '../life.js';

describe('bot life', () => {
  it('skill drifts a step with the result inside its bounds', () => {
    expect(driftSkill(50, 'win')).toBe(51);
    expect(driftSkill(50, 'loss')).toBe(49);
    expect(driftSkill(50, 'draw')).toBe(50);
    expect(driftSkill(BOT_SKILL_DRIFT_MAX, 'win')).toBe(BOT_SKILL_DRIFT_MAX);
    expect(driftSkill(BOT_SKILL_DRIFT_MIN, 'loss')).toBe(BOT_SKILL_DRIFT_MIN);
  });
  it('a face change needs a milestone level, and then only sometimes', () => {
    expect(changesAvatar(6, 7, () => 0)).toBe(false);
    expect(changesAvatar(4, 5, () => 0)).toBe(true);
    expect(changesAvatar(4, 5, () => 0.99)).toBe(false);
    expect(changesAvatar(5, 4, () => 0)).toBe(false);
    const rng = mulberry32(1);
    const hits = Array.from({ length: 200 }, () => changesAvatar(9, 10, rng)).filter(Boolean).length;
    expect(hits).toBeGreaterThan(50);
    expect(hits).toBeLessThan(110);
  });
  it('the Tehran hour is UTC+3:30 and the night is quieter but never empty', () => {
    expect(tehranHour(Date.UTC(2026, 9, 7, 0, 0))).toBe(3);
    expect(tehranHour(Date.UTC(2026, 9, 7, 20, 45))).toBe(0);
    expect(scaledByActivity(5, Date.UTC(2026, 9, 7, 0, 0))).toBeLessThan(scaledByActivity(5, Date.UTC(2026, 9, 7, 15, 0)));
    expect(scaledByActivity(1, Date.UTC(2026, 9, 7, 0, 0))).toBe(1);
    expect(scaledByActivity(0, Date.UTC(2026, 9, 7, 15, 0))).toBe(0);
  });
});
