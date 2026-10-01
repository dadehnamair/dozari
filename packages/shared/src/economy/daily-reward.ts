import { DAILY_REWARD_COOLDOWN_HOURS, DAILY_REWARD_STREAK_WINDOW_HOURS } from '../config/index.js';

const HOUR_MS = 60 * 60 * 1000;

/** What we remember about a player's daily rewards. */
export interface DailyRewardState {
  /** Epoch ms of the last claim, or null if they never claimed. */
  lastClaimedAt: number | null;
  /** Streak day of the last claim (1 = first day); 0 when there was none. */
  streakDay: number;
}

export type DailyRewardDecision =
  /** `day` is the streak day being claimed, `coins` what it pays. */
  | { status: 'ready'; day: number; coins: number }
  /** Claimed too recently: try again at `availableAt` (epoch ms). */
  | { status: 'wait'; availableAt: number }
  /** No reward steps are configured. */
  | { status: 'disabled' };

/** Coins for a streak day: the configured step, and the last step repeats once the list runs out. */
export function coinsForDay(steps: readonly number[], day: number): number {
  const last = steps.length - 1;
  return steps[Math.min(Math.max(day, 1) - 1, last)] as number;
}

/**
 * One claim per 24 h. A claim 24-48 h after the previous one moves to the next streak day; waiting longer than that
 * (a whole day skipped) starts over at day 1. Pure: the clock is passed in.
 */
export interface DailyRules {
  cooldownHours: number;
  windowHours: number;
}
export const DEFAULT_DAILY_RULES: DailyRules = { cooldownHours: DAILY_REWARD_COOLDOWN_HOURS, windowHours: DAILY_REWARD_STREAK_WINDOW_HOURS };

export function nextDailyReward(state: DailyRewardState, steps: readonly number[], now: number, rules: DailyRules = DEFAULT_DAILY_RULES): DailyRewardDecision {
  if (steps.length === 0) return { status: 'disabled' };
  if (state.lastClaimedAt === null) return { status: 'ready', day: 1, coins: coinsForDay(steps, 1) };

  const availableAt = state.lastClaimedAt + rules.cooldownHours * HOUR_MS;
  if (now < availableAt) return { status: 'wait', availableAt };

  const continues = now < state.lastClaimedAt + rules.windowHours * HOUR_MS;
  const day = continues ? state.streakDay + 1 : 1;
  return { status: 'ready', day, coins: coinsForDay(steps, day) };
}

/** State after a successful claim. */
export const afterClaim = (day: number, now: number): DailyRewardState => ({ lastClaimedAt: now, streakDay: day });

/** True when `steps` is something an admin may save: 1..max days, each a whole number of coins in 1..max. */
export function validDailySteps(steps: readonly number[], maxDays: number, maxCoins: number): boolean {
  return steps.length >= 1 && steps.length <= maxDays && steps.every((c) => Number.isInteger(c) && c >= 1 && c <= maxCoins);
}
