import { BOT_ACTIVITY_BY_HOUR, BOT_AVATAR_CHANGE_EVERY_LEVELS, BOT_AVATAR_CHANGE_PERCENT, BOT_SKILL_DRIFT_MAX, BOT_SKILL_DRIFT_MIN, BOT_SKILL_DRIFT_STEP } from '../config/botSkill.js';
import type { Rng } from '../game/rng.js';

const TEHRAN_OFFSET_MS = 3.5 * 3_600_000;
const HOUR_MS = 3_600_000;

/** Hour of the day (0-23) in Tehran at `ms`. */
export const tehranHour = (ms: number): number => Math.floor((((ms + TEHRAN_OFFSET_MS) % (24 * HOUR_MS)) + 24 * HOUR_MS) % (24 * HOUR_MS) / HOUR_MS);

/** A bot's skill after a game: a step up for a win, down for a loss, unchanged for a draw, kept inside the bounds. */
export function driftSkill(skill: number, outcome: 'win' | 'loss' | 'draw'): number {
  const next = skill + (outcome === 'win' ? BOT_SKILL_DRIFT_STEP : outcome === 'loss' ? -BOT_SKILL_DRIFT_STEP : 0);
  return Math.max(BOT_SKILL_DRIFT_MIN, Math.min(BOT_SKILL_DRIFT_MAX, next));
}

/** Does a bot that just rose from `from` to `to` change its face? Only when it crosses a milestone level, and then by chance. */
export function changesAvatar(from: number, to: number, rng: Rng): boolean {
  if (to <= from) return false;
  const crossed = Math.floor(to / BOT_AVATAR_CHANGE_EVERY_LEVELS) > Math.floor(from / BOT_AVATAR_CHANGE_EVERY_LEVELS);
  return crossed && rng() * 100 < BOT_AVATAR_CHANGE_PERCENT;
}

/** `count` scaled by how busy the lobby is at this Tehran hour; at least one while `count` is above zero. */
export function scaledByActivity(count: number, ms: number): number {
  if (count <= 0) return 0;
  const pct = BOT_ACTIVITY_BY_HOUR[tehranHour(ms)] ?? 100;
  return Math.max(1, Math.round((count * pct) / 100));
}
