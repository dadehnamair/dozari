import {
  BOT_ACCURACY_MAX_PERCENT,
  BOT_ACCURACY_MIN_PERCENT,
  BOT_PRICE_ERROR_MIN_PERCENT,
  BOT_PRICE_ERROR_NUDGE_PER_POINT,
  BOT_SKILL_BANDS,
  BOT_SKILL_NEUTRAL,
  BOT_SKILL_NUDGE_PER_POINT,
} from '../config/botSkill.js';
import type { BotSkillBand } from '../config/botSkill.js';

export interface BotSkillProfile {
  /** Index of the level band (0 = lowest). */
  band: number;
  /** Chance (percent) of submitting a real group. */
  accuracyPercent: number;
  /** Chance (percent), among misses, of a one-away pick. */
  nearMissPercent: number;
  /** Multiplier (percent) on the bot's think-time range. */
  thinkScalePercent: number;
  /** Largest price-guess error, percent of the real price. */
  priceMaxErrorPercent: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Skill parameters for a bot of `level`; `skill` (0-100, the per-bot admin knob) nudges accuracy and price error around the level's band.
 * Pure and deterministic: higher level = more accurate, faster, tighter price guesses. Never grants any knowledge of the answer.
 */
export function botSkillForLevel(level: number, skill: number = BOT_SKILL_NEUTRAL, bands: readonly BotSkillBand[] = BOT_SKILL_BANDS): BotSkillProfile {
  const lvl = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  let band = 0;
  for (let i = 0; i < bands.length; i++) if (lvl >= (bands[i] as BotSkillBand).minLevel) band = i;
  const b = bands[band] as BotSkillBand;
  const off = clamp(skill, 0, 100) - BOT_SKILL_NEUTRAL;
  return {
    band,
    accuracyPercent: Math.round(clamp(b.accuracyPercent + off * BOT_SKILL_NUDGE_PER_POINT, BOT_ACCURACY_MIN_PERCENT, BOT_ACCURACY_MAX_PERCENT)),
    nearMissPercent: b.nearMissPercent,
    thinkScalePercent: b.thinkScalePercent,
    priceMaxErrorPercent: Math.round(Math.max(BOT_PRICE_ERROR_MIN_PERCENT, b.priceMaxErrorPercent - off * BOT_PRICE_ERROR_NUDGE_PER_POINT)),
  };
}

/** A think-time range scaled by the profile (low levels think longer). */
export function scaledThinkRange(minMs: number, maxMs: number, profile: Pick<BotSkillProfile, 'thinkScalePercent'>): { minMs: number; maxMs: number } {
  const k = profile.thinkScalePercent / 100;
  return { minMs: Math.round(minMs * k), maxMs: Math.round(maxMs * k) };
}
