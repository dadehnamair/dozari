import { DEFAULT_DAILY_REWARD_STEPS, DEFAULT_DAILY_RULES, MAX_DAILY_REWARD_COINS, MAX_DAILY_REWARD_DAYS, afterClaim, coinsForDay, nextDailyReward, validDailySteps } from '@dozari/shared';
import type { DailyRewardState, DailyRules } from '@dozari/shared';

/** What the app shows on the daily reward card. */
export interface DailyRewardStatus {
  canClaim: boolean;
  /** Streak day that the next claim would be (1 = restart). */
  day: number;
  /** Coins the next claim pays. */
  coins: number;
  /** Epoch ms when the next claim opens; null when it already is open. */
  nextClaimAt: number | null;
  /** Coins for every configured day, for the "7-day card". */
  steps: number[];
  balance: number;
}

export type ClaimResult =
  | { ok: true; day: number; coins: number; balance: number; nextClaimAt: number }
  | { ok: false; error: 'TOO_EARLY'; nextClaimAt: number }
  | { ok: false; error: 'DISABLED' };

/** I/O boundary: per-player state, the admin-set steps, and the atomic claim. */
export interface DailyRewardStore {
  getSteps(): Promise<number[] | null>;
  setSteps(steps: number[]): Promise<void>;
  getState(userId: string): Promise<{ state: DailyRewardState; balance: number }>;
  /**
   * Atomically (one transaction, row locked): re-read the player's state, ask `decide`, and when it says `ready` record the
   * claim and credit the coins through the ledger. Returns what happened.
   */
  claim(userId: string, now: number, steps: number[], rules: DailyRules): Promise<ClaimResult>;
}

export class DailyRewardService {
  constructor(
    private readonly store: DailyRewardStore,
    private readonly now: () => number = Date.now,
    /** Cooldown and streak window; the admin panel's settings in production. */
    private readonly rules: () => Promise<DailyRules> = async () => DEFAULT_DAILY_RULES,
  ) {}

  async steps(): Promise<number[]> {
    return (await this.store.getSteps()) ?? [...DEFAULT_DAILY_REWARD_STEPS];
  }

  async status(userId: string): Promise<DailyRewardStatus> {
    const [steps, { state, balance }] = await Promise.all([this.steps(), this.store.getState(userId)]);
    const d = nextDailyReward(state, steps, this.now(), await this.rules());
    if (d.status === 'disabled') return { canClaim: false, day: 1, coins: 0, nextClaimAt: null, steps, balance };
    if (d.status === 'wait') {
      // The day it will be when the cooldown ends: the streak continues (the window is wider than the cooldown).
      const day = state.streakDay + 1;
      return { canClaim: false, day, coins: coinsForDay(steps, day), nextClaimAt: d.availableAt, steps, balance };
    }
    return { canClaim: true, day: d.day, coins: d.coins, nextClaimAt: null, steps, balance };
  }

  async claim(userId: string): Promise<ClaimResult> {
    return this.store.claim(userId, this.now(), await this.steps(), await this.rules());
  }

  /** Admin: replace the day-by-day amounts. Returns false when the list is not acceptable. */
  async setSteps(steps: number[]): Promise<boolean> {
    if (!validDailySteps(steps, MAX_DAILY_REWARD_DAYS, MAX_DAILY_REWARD_COINS)) return false;
    await this.store.setSteps(steps);
    return true;
  }
}

/** Shared decision used by every store implementation, so the rule exists once. */
export function decideClaim(state: DailyRewardState, steps: number[], now: number, rules: DailyRules = DEFAULT_DAILY_RULES) {
  const d = nextDailyReward(state, steps, now, rules);
  if (d.status === 'ready') {
    return { kind: 'ready' as const, day: d.day, coins: d.coins, next: afterClaim(d.day, now), nextClaimAt: now + rules.cooldownHours * 3_600_000 };
  }
  return d.status === 'wait' ? { kind: 'wait' as const, nextClaimAt: d.availableAt } : { kind: 'disabled' as const };
}
