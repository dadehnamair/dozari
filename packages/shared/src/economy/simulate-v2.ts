import {
  BROKE_RESCUE_TARGET,
  DAILY_FREE_MATCHES,
  DAILY_PUZZLE_REWARD,
  DAILY_SHOP_COIN_PRICES,
  DEFAULT_DAILY_REWARD_STEPS,
  FREE_MATCH_PAYOUT_PERCENT,
  HOUSE_CUT_PERCENT,
  KEEPSAKE_DROP_CHANCE,
  KEEPSAKE_MAX_LEVEL,
  KEEPSAKE_PIECES,
  KEEPSAKE_PIECE_SHOP_PRICE,
  KEEPSAKE_UPGRADE_COST,
  LOSS_CONSOLATION,
  LOSS_CONSOLATION_DAILY_CAP,
  NON_SKILL_DAILY_CAP,
  SIGNUP_BONUS,
  STAKE_TIERS,
  STREAK_SHIELD_MAX_HELD,
  STREAK_SHIELD_PRICE,
  type StakeTier,
} from '../config/economy.js';
import { mulberry32 } from '../game/index.js';

/**
 * Economy v2 balance model (docs/logic/economy-v2.md). Like `simulateEconomy` but every faucet and sink of D204 is in it, so
 * "faucet ≈ sink for an active player" can be checked before anything is built. Human-vs-human is zero-sum apart from the house cut
 * (win rate ≈ loss rate); bot matches mint the subsidy on a human win and swallow the pot on a loss.
 * Behaviour numbers (appetites, reserve) are assumptions, not data: re-fit them from the real ledger after launch.
 */
export interface SimV2Params {
  players: number;
  days: number;
  seed: number;
  winRate: number;
  drawRate: number;
  buckets: ReadonlyArray<{ share: number; matchesPerDay: number; activeDayChance: number }>;
  claimsDaily: number;
  solvesDailyPuzzle: number;
  /** Missions: chance of finishing the daily mission on an active day, and its coins. */
  missionChance: number;
  missionCoins: number;
  /** Level coins (every 5th level, progression.md): average coins per played match. */
  levelCoinsPerMatch: number;
  /** Share of duels that are against a bot, and the human's win chance there. */
  botShare: number;
  botWinRate: number;
  /** Stake tiers on offer; a player sits at the richest tier whose fee × `bankrollMultiple` fits the balance. */
  tiers: readonly StakeTier[];
  bankrollMultiple: number;
  /** Free-match win pays the normal payout times this percent. */
  freePayoutPercent: number;
  /** Soft cap on non-skill coins per day, 0 = none. */
  nonSkillCap: number;
  /** Sinks switched on: daily shop, streak shield, keepsake pieces/upgrades. */
  shop: boolean;
  shield: boolean;
  keepsakes: boolean;
  /** A player never spends below this many fees of their current tier. */
  reserveFees: number;
  /** Chance on an active day that the player looks at the shop / buys a shield / buys a piece when they can afford it. */
  shopAppetite: number;
  shieldAppetite: number;
  pieceAppetite: number;
}

export const DEFAULT_SIM_V2: SimV2Params = {
  players: 2000,
  days: 90,
  seed: 7,
  winRate: 0.475,
  drawRate: 0.05,
  buckets: [
    { share: 0.5, matchesPerDay: 3, activeDayChance: 0.9 },
    { share: 0.35, matchesPerDay: 6, activeDayChance: 0.6 },
    { share: 0.15, matchesPerDay: 12, activeDayChance: 0.8 },
  ],
  claimsDaily: 0.9,
  solvesDailyPuzzle: 0.5,
  missionChance: 0.6,
  missionCoins: 15,
  levelCoinsPerMatch: 1.2,
  botShare: 0.25,
  botWinRate: 0.55,
  tiers: STAKE_TIERS,
  bankrollMultiple: 10,
  freePayoutPercent: FREE_MATCH_PAYOUT_PERCENT,
  nonSkillCap: NON_SKILL_DAILY_CAP,
  shop: true,
  shield: true,
  keepsakes: true,
  reserveFees: 3,
  shopAppetite: 0.5,
  shieldAppetite: 0.3,
  pieceAppetite: 0.4,
};

/** The pre-D204 economy on the same model: bronze only, no cap, no shop/shield/keepsakes. */
export const BASELINE_SIM_V2: SimV2Params = {
  ...DEFAULT_SIM_V2,
  tiers: STAKE_TIERS.slice(0, 1),
  nonSkillCap: 0,
  shop: false,
  shield: false,
  keepsakes: false,
};

export interface SimV2Result {
  /** Balance spread on the last day. */
  median: number;
  p10: number;
  p90: number;
  /** Median balance at the end of each week: a plateau means the economy is stable. */
  medianByWeek: number[];
  stuckPercent: number;
  /** Per player over the run, by source. */
  faucets: Record<string, number>;
  sinks: Record<string, number>;
  faucetTotal: number;
  sinkTotal: number;
  /** faucetTotal / sinkTotal: near 1 is steady, far above 1 inflates. */
  ratio: number;
}

function pct(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
}

function rewardStep(streak: number): number {
  const steps = DEFAULT_DAILY_REWARD_STEPS;
  return steps[Math.min(streak, steps.length) - 1] ?? 0;
}

export function simulateEconomyV2(params: SimV2Params = DEFAULT_SIM_V2): SimV2Result {
  const rng = mulberry32(params.seed);
  const faucets: Record<string, number> = {};
  const sinks: Record<string, number> = {};
  const add = (m: Record<string, number>, k: string, v: number) => {
    m[k] = (m[k] ?? 0) + v;
  };
  const tiers = [...params.tiers].sort((a, b) => a.fee - b.fee);
  const base = tiers[0]!;
  const weeks = Math.floor(params.days / 7);
  const weekBalances: number[][] = Array.from({ length: weeks }, () => []);
  const finals: number[] = [];
  let stuckDays = 0;
  let totalDays = 0;
  for (let p = 0; p < params.players; p++) {
    let r = rng();
    const bucket = params.buckets.find((b) => (r -= b.share) < 0) ?? params.buckets[params.buckets.length - 1]!;
    let coins = SIGNUP_BONUS;
    add(faucets, 'signup', SIGNUP_BONUS);
    let streak = 0;
    let shields = 0;
    let pieces = 0;
    let completed = 0;
    let upgrades = 0;
    for (let d = 0; d < params.days; d++) {
      const active = rng() < bucket.activeDayChance;
      if (!active) {
        if (streak > 0 && shields > 0) shields -= 1;
        else streak = 0;
        if (d % 7 === 6 && d / 7 < weeks) weekBalances[Math.floor(d / 7)]!.push(coins);
        continue;
      }
      let nonSkill = 0;
      const earnNonSkill = (source: string, amount: number) => {
        const room = params.nonSkillCap > 0 ? Math.max(0, params.nonSkillCap - nonSkill) : amount;
        const got = Math.min(amount, room);
        nonSkill += got;
        coins += got;
        add(faucets, source, got);
      };
      let freeLeft = DAILY_FREE_MATCHES;
      let consolation = 0;
      let rescued = false;
      if (rng() < params.claimsDaily) {
        streak += 1;
        earnNonSkill('daily_reward', rewardStep(streak));
      }
      if (rng() < params.solvesDailyPuzzle) earnNonSkill('daily_puzzle', DAILY_PUZZLE_REWARD);
      if (rng() < params.missionChance) earnNonSkill('missions', params.missionCoins);

      for (let m = 0; m < bucket.matchesPerDay; m++) {
        const free = freeLeft > 0;
        const tier = free
          ? base
          : ([...tiers].reverse().find((t) => coins >= t.fee * params.bankrollMultiple) ?? tiers.find((t) => coins >= t.fee) ?? base);
        const fee = tier.fee;
        if (!free && coins < fee) {
          if (!rescued) {
            add(faucets, 'rescue', BROKE_RESCUE_TARGET - coins);
            coins = BROKE_RESCUE_TARGET;
            rescued = true;
          } else break;
        }
        const pot = fee * 2;
        const payout = Math.floor((pot * (100 - HOUSE_CUT_PERCENT)) / 100);
        const vsBot = rng() < params.botShare;
        const roll = rng();
        const levelCoins = params.levelCoinsPerMatch;
        coins += levelCoins;
        add(faucets, 'level', levelCoins);
        if (free) {
          freeLeft -= 1;
          if (roll < (vsBot ? params.botWinRate : params.winRate)) {
            const w = Math.floor((payout * params.freePayoutPercent) / 100);
            coins += w;
            add(faucets, 'free_match', w);
            if (!vsBot && params.keepsakes && rng() < KEEPSAKE_DROP_CHANCE) pieces += 1;
          }
          continue;
        }
        coins -= fee;
        if (vsBot) {
          if (roll < params.botWinRate) {
            coins += payout;
            add(faucets, 'bot_subsidy', fee);
            add(sinks, 'house_cut', pot - payout);
          } else add(sinks, 'bot_loss', fee);
          continue;
        }
        if (roll < params.winRate) {
          coins += payout;
          add(sinks, 'house_cut', pot - payout);
          if (params.keepsakes && rng() < KEEPSAKE_DROP_CHANCE) pieces += 1;
        } else if (roll < params.winRate + params.drawRate) {
          const refund = Math.floor((fee * (100 - HOUSE_CUT_PERCENT)) / 100);
          coins += refund;
          add(sinks, 'house_cut', fee - refund);
        } else if (consolation < LOSS_CONSOLATION_DAILY_CAP) {
          const c = Math.min(LOSS_CONSOLATION, LOSS_CONSOLATION_DAILY_CAP - consolation);
          consolation += c;
          coins += c;
          add(faucets, 'consolation', c);
        }
      }

      // Sinks the player chooses to use: never dip below `reserveFees` fees of the current tier.
      const reserve = () => {
        const t = [...tiers].reverse().find((x) => coins >= x.fee * params.bankrollMultiple) ?? base;
        return t.fee * params.reserveFees;
      };
      if (params.shield && streak >= 3 && shields < STREAK_SHIELD_MAX_HELD && coins - STREAK_SHIELD_PRICE >= reserve() && rng() < params.shieldAppetite) {
        coins -= STREAK_SHIELD_PRICE;
        shields += 1;
        add(sinks, 'streak_shield', STREAK_SHIELD_PRICE);
      }
      if (params.shop && rng() < params.shopAppetite) {
        const price = [...DAILY_SHOP_COIN_PRICES].reverse().find((x) => coins - x >= reserve());
        if (price !== undefined) {
          coins -= price;
          add(sinks, 'daily_shop', price);
        }
      }
      if (params.keepsakes) {
        if (coins - KEEPSAKE_PIECE_SHOP_PRICE >= reserve() && rng() < params.pieceAppetite) {
          coins -= KEEPSAKE_PIECE_SHOP_PRICE;
          pieces += 1;
          add(sinks, 'keepsake_piece', KEEPSAKE_PIECE_SHOP_PRICE);
        }
        while (pieces >= KEEPSAKE_PIECES) {
          pieces -= KEEPSAKE_PIECES;
          completed += 1;
        }
        if (completed * KEEPSAKE_MAX_LEVEL > upgrades && coins - KEEPSAKE_UPGRADE_COST >= reserve() && rng() < params.pieceAppetite) {
          coins -= KEEPSAKE_UPGRADE_COST;
          upgrades += 1;
          add(sinks, 'keepsake_upgrade', KEEPSAKE_UPGRADE_COST);
        }
      }
      totalDays += 1;
      if (coins < base.fee && freeLeft === 0) stuckDays += 1;
      if (d % 7 === 6 && d / 7 < weeks) weekBalances[Math.floor(d / 7)]!.push(coins);
    }
    finals.push(coins);
  }
  finals.sort((a, b) => a - b);
  const per = (m: Record<string, number>) =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.round((v / params.players) * 10) / 10]));
  const faucetTotal = Object.values(faucets).reduce((a, b) => a + b, 0) / params.players;
  const sinkTotal = Object.values(sinks).reduce((a, b) => a + b, 0) / params.players;
  return {
    median: pct(finals, 0.5),
    p10: pct(finals, 0.1),
    p90: pct(finals, 0.9),
    medianByWeek: weekBalances.map((w) => pct([...w].sort((a, b) => a - b), 0.5)),
    stuckPercent: totalDays === 0 ? 0 : (stuckDays / totalDays) * 100,
    faucets: per(faucets),
    sinks: per(sinks),
    faucetTotal: Math.round(faucetTotal * 10) / 10,
    sinkTotal: Math.round(sinkTotal * 10) / 10,
    ratio: sinkTotal === 0 ? Infinity : Math.round((faucetTotal / sinkTotal) * 100) / 100,
  };
}
