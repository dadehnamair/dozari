import {
  BROKE_RESCUE_TARGET,
  DAILY_FREE_MATCHES,
  DAILY_PUZZLE_REWARD,
  DEFAULT_DAILY_REWARD_STEPS,
  ENTRY_FEE_BASE,
  FREE_MATCH_PAYOUT_PERCENT,
  HOUSE_CUT_PERCENT,
  LOSS_CONSOLATION,
  LOSS_CONSOLATION_DAILY_CAP,
  SIGNUP_BONUS,
} from '../config/economy.js';
import { mulberry32 } from '../game/index.js';

export interface SimParams {
  players: number;
  days: number;
  seed: number;
  /** Win chance of a paid duel, 0..1. */
  winRate: number;
  /** Chance a played duel is a draw (taken from the non-win share). */
  drawRate: number;
  /** Matches per active day for each play-frequency bucket and its share of players. */
  buckets: ReadonlyArray<{ share: number; matchesPerDay: number; activeDayChance: number }>;
  /** Odds the player opens the app and claims the daily reward / solves the daily puzzle on an active day. */
  claimsDaily: number;
  solvesDailyPuzzle: number;
}

export const DEFAULT_SIM: SimParams = {
  players: 2000,
  days: 30,
  seed: 7,
  winRate: 0.45,
  drawRate: 0.05,
  buckets: [
    { share: 0.5, matchesPerDay: 3, activeDayChance: 0.9 },
    { share: 0.35, matchesPerDay: 6, activeDayChance: 0.6 },
    { share: 0.15, matchesPerDay: 12, activeDayChance: 0.8 },
  ],
  claimsDaily: 0.9,
  solvesDailyPuzzle: 0.5,
};

export interface SimResult {
  median: number;
  p10: number;
  p90: number;
  /** Share of player-days that ended at 0 coins with nothing left to play for free. */
  stuckPercent: number;
  /** Net coins the economy created (faucets) minus burned by the house, per player over the run. */
  faucetPerPlayer: number;
  burnPerPlayer: number;
}

function pct(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
}

function stepAmount(streak: number): number {
  const steps = DEFAULT_DAILY_REWARD_STEPS;
  return steps[Math.min(streak, steps.length) - 1] ?? 0;
}

/** Rough day-by-day model of one player population. Pot = both entry fees; a free match risks nothing. */
export function simulateEconomy(params: SimParams = DEFAULT_SIM): SimResult {
  const rng = mulberry32(params.seed);
  const finals: number[] = [];
  let stuckDays = 0;
  let totalDays = 0;
  let faucet = 0;
  let burn = 0;
  for (let p = 0; p < params.players; p++) {
    let r = rng();
    const bucket = params.buckets.find((b) => (r -= b.share) < 0) ?? params.buckets[params.buckets.length - 1]!;
    let coins = SIGNUP_BONUS;
    faucet += SIGNUP_BONUS;
    let streak = 0;
    for (let d = 0; d < params.days; d++) {
      if (rng() >= bucket.activeDayChance) {
        streak = 0;
        continue;
      }
      let freeLeft = DAILY_FREE_MATCHES;
      let consolation = 0;
      let rescued = false;
      if (rng() < params.claimsDaily) {
        streak += 1;
        const c = stepAmount(streak);
        coins += c;
        faucet += c;
      }
      if (rng() < params.solvesDailyPuzzle) {
        coins += DAILY_PUZZLE_REWARD;
        faucet += DAILY_PUZZLE_REWARD;
      }
      for (let m = 0; m < bucket.matchesPerDay; m++) {
        const free = freeLeft > 0;
        if (!free && coins < ENTRY_FEE_BASE) {
          if (!rescued && coins < ENTRY_FEE_BASE) {
            faucet += BROKE_RESCUE_TARGET - coins;
            coins = BROKE_RESCUE_TARGET;
            rescued = true;
          } else break;
        }
        const pot = ENTRY_FEE_BASE * 2;
        const payout = Math.floor((pot * (100 - HOUSE_CUT_PERCENT)) / 100);
        const roll = rng();
        if (free) {
          freeLeft -= 1;
          if (roll < params.winRate) {
            const w = Math.floor((payout * FREE_MATCH_PAYOUT_PERCENT) / 100);
            coins += w;
            faucet += w;
          }
          continue;
        }
        coins -= ENTRY_FEE_BASE;
        if (roll < params.winRate) {
          coins += payout;
          burn += pot - payout;
        } else if (roll < params.winRate + params.drawRate) {
          const refund = Math.floor((ENTRY_FEE_BASE * (100 - HOUSE_CUT_PERCENT)) / 100);
          coins += refund;
          burn += ENTRY_FEE_BASE - refund;
        } else if (consolation < LOSS_CONSOLATION_DAILY_CAP) {
          const c = Math.min(LOSS_CONSOLATION, LOSS_CONSOLATION_DAILY_CAP - consolation);
          consolation += c;
          coins += c;
          faucet += c;
        }
      }
      totalDays += 1;
      if (coins < ENTRY_FEE_BASE && freeLeft === 0) stuckDays += 1;
    }
    finals.push(coins);
  }
  finals.sort((a, b) => a - b);
  return {
    median: pct(finals, 0.5),
    p10: pct(finals, 0.1),
    p90: pct(finals, 0.9),
    stuckPercent: totalDays === 0 ? 0 : (stuckDays / totalDays) * 100,
    faucetPerPlayer: faucet / params.players,
    burnPerPlayer: burn / params.players,
  };
}
