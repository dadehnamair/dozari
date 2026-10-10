import { BOT_MATCH_LEVEL_GAP } from '../config/botSkill.js';
import type { Rng } from '../game/rng.js';

export interface BotCandidate {
  id: string;
  /** The bot's level; a bot without one counts as level 1. */
  level?: number;
}

/**
 * The bot a waiting human is paired with: chosen at random among the bots whose level is within `gap` of the human's level; when none is that
 * near, among the ones at the smallest distance. Null when there are no candidates. Pure; randomness comes from `rng`.
 */
export function pickBotByLevel(candidates: readonly BotCandidate[], humanLevel: number, rng: Rng, gap: number = BOT_MATCH_LEVEL_GAP): BotCandidate | null {
  if (candidates.length === 0) return null;
  const dist = (c: BotCandidate) => Math.abs((c.level ?? 1) - humanLevel);
  const best = Math.min(...candidates.map(dist));
  const pool = candidates.filter((c) => dist(c) <= Math.max(gap, best));
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] ?? null;
}

/** For a team match: the level to match bots to is the average of the humans' levels. */
export const averageLevel = (levels: readonly number[]): number => (levels.length === 0 ? 1 : Math.round(levels.reduce((a, b) => a + b, 0) / levels.length));
