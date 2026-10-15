import { BOT_MATCH_LEVEL_GAP, BOT_REPEAT_COOLDOWN_GAMES, BOT_REPEAT_COOLDOWN_MS } from '../config/botSkill.js';
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

/** A bot a human met, newest last. */
export interface BotMeeting {
  botId: string;
  at: number;
}

/**
 * Drops the bots this human met lately: the last `BOT_REPEAT_COOLDOWN_GAMES` of their games, and anyone met within `BOT_REPEAT_COOLDOWN_MS`.
 * When that would leave nobody, the bot met longest ago is allowed (a search must not starve). Pure.
 */
export function withoutRecentBots<T extends { id: string }>(candidates: readonly T[], history: readonly BotMeeting[], now: number): T[] {
  const lastGames = new Set(history.slice(-BOT_REPEAT_COOLDOWN_GAMES).map((m) => m.botId));
  const lately = new Set(history.filter((m) => now - m.at < BOT_REPEAT_COOLDOWN_MS).map((m) => m.botId));
  const fresh = candidates.filter((c) => !lastGames.has(c.id) && !lately.has(c.id));
  if (fresh.length > 0 || candidates.length === 0) return fresh;
  const metAt = (id: string) => history.reduce((t, m) => (m.botId === id ? m.at : t), -Infinity);
  const oldest = [...candidates].sort((a, b) => metAt(a.id) - metAt(b.id))[0];
  return oldest ? [oldest] : [];
}
