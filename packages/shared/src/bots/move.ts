import { BOT_NEAR_MISS_PERCENT } from '../config/botSkill.js';
import type { Rng } from '../game/rng.js';

export interface BotMoveInput {
  /** Unsolved groups as product id lists (server side only: bots play inside the server, never over a socket). */
  groups: readonly (readonly string[])[];
  /** Cards still on the board. */
  remaining: readonly string[];
  /** 0 = clueless, 100 = nearly always right. */
  skill: number;
  /** Overrides the skill-derived chance (percent) of a real group (see `botSkillForLevel`). */
  accuracyPercent?: number;
  /** Chance (percent) of a one-away pick when the real group was missed; default `BOT_NEAR_MISS_PERCENT`. */
  nearMissPercent?: number;
  rng: Rng;
}

const sample = <T>(items: readonly T[], n: number, rng: Rng): T[] => {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < n && pool.length > 0) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0] as T);
  return out;
};

/**
 * A human-like selection of four cards. With probability about `skill`% (never above 90 %) the bot submits a real group; otherwise it
 * "almost" finds one (three right plus an intruder) or just guesses. Imperfect on purpose (docs/logic/bots.md). The caller submits it
 * through the same match command as a human.
 */
export function chooseBotMove(input: BotMoveInput): string[] {
  const { groups, remaining, rng } = input;
  const skill = Math.max(0, Math.min(100, input.skill));
  const usable = groups.filter((g) => g.length === 4);
  const roll = rng() * 100;
  const accuracy = Math.min(90, input.accuracyPercent ?? skill);
  const nearMiss = input.nearMissPercent ?? BOT_NEAR_MISS_PERCENT;
  if (usable.length > 0 && roll < accuracy) return [...(usable[Math.floor(rng() * usable.length)] as readonly string[])];
  if (usable.length > 0 && roll < accuracy + (100 - accuracy) * (nearMiss / 100)) {
    // One away: three of a group plus one card from elsewhere.
    const group = usable[Math.floor(rng() * usable.length)] as readonly string[];
    const outsiders = remaining.filter((c) => !group.includes(c));
    if (outsiders.length > 0) return [...sample(group, 3, rng), sample(outsiders, 1, rng)[0] as string];
  }
  return sample(remaining, 4, rng);
}

/** How long a bot "thinks" before its move: uniform in [min, max], never so long that it would miss the turn (leaves `margin` ms). */
export function botThinkDelay(minMs: number, maxMs: number, msLeft: number, rng: Rng, margin = 2500): number {
  const span = Math.max(0, maxMs - minMs);
  const wanted = minMs + Math.floor(rng() * (span + 1));
  return Math.max(0, Math.min(wanted, msLeft - margin));
}

export interface BotPriceGuessInput {
  actualRials: bigint;
  /** 0 = wild guesses, 100 = close. */
  skill: number;
  /** Overrides the skill-derived largest error (percent of the real price). */
  maxErrorPercent?: number;
  rng: Rng;
}

/**
 * A human-like price guess: the real price off by a random error that shrinks with skill (about ±5 % at 100, ±65 % at 0), never zero.
 * Server side only: the caller reads the real price from the match, the bot never sees it over a socket.
 */
export function chooseBotPriceGuess(input: BotPriceGuessInput): bigint {
  const skill = Math.max(0, Math.min(100, input.skill));
  const maxError = input.maxErrorPercent !== undefined ? Math.max(0, input.maxErrorPercent) / 100 : 0.05 + 0.6 * (1 - skill / 100);
  const error = (input.rng() * 2 - 1) * maxError;
  const guess = BigInt(Math.round(Number(input.actualRials) * (1 + error)));
  return guess > 0n ? guess : 1n;
}
