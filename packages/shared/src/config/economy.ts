/** Coin economy numbers (CLAUDE.md rule 9; docs/logic/economy.md). Proposed defaults, tunable. */

/** Daily reward: one claim per cooldown, a streak that grows by day and breaks when a whole day is skipped. */
export const DAILY_REWARD_COOLDOWN_HOURS = 24;
/** A claim within this many hours of the previous one continues the streak; later ones start again at day 1. */
export const DAILY_REWARD_STREAK_WINDOW_HOURS = 48;
/** Coins for day 1, 2, 3 … of a streak. Editable from the admin panel; after the last day the last amount repeats. */
export const DEFAULT_DAILY_REWARD_STEPS: readonly number[] = [10, 15, 20];
export const MAX_DAILY_REWARD_DAYS = 60;
export const MAX_DAILY_REWARD_COINS = 10_000;

/** Solo-game hints bought with coins (owner item 1). Every number is an admin setting; these are the launch defaults. */
export const HINT_KINDS = ['group_title', 'one_card', 'pair'] as const;
export const HINT_PRICES: Readonly<Record<(typeof HINT_KINDS)[number], number>> = { group_title: 15, one_card: 20, pair: 35 };
/** A player must reach this level before hints unlock (it keeps day-one coins for matches). */
export const HINT_MIN_LEVEL = 2;
/** First level that may join the live duel queue (1v1 and 2v2): brand-new players who do not know the game yet get beaten and quit (admin-editable, `duel.min_level`). */
export const DUEL_MIN_LEVEL = 3;
export const HINT_MAX_PER_GAME = 2;
/** The 2nd and later hint of one game cost this percent of the listed price. */
export const HINT_REPEAT_PERCENT = 200;

/** Daily puzzle (owner item 15): one attempt a day, a small reward for solving, growing with the win streak. */
export const DAILY_PUZZLE_REWARD = 20;
/** Extra coins per streak day beyond the first, up to `DAILY_PUZZLE_STREAK_MAX_DAYS`. */
export const DAILY_PUZZLE_STREAK_STEP = 5;
export const DAILY_PUZZLE_STREAK_MAX_DAYS = 7;
/** A puzzle used as a daily one is not picked again within this many days (when others exist). */
export const DAILY_PUZZLE_REPEAT_DAYS = 30;

/** Match economy launch defaults (docs/logic/economy.md). Used by the balance simulator; live matches read the same values. */
export const SIGNUP_BONUS = 200;
export const ENTRY_FEE_BASE = 20;
/** Share of every pot burned by the house, in percent. */
export const HOUSE_CUT_PERCENT = 10;
export const DAILY_FREE_MATCHES = 3;
/** A free-match win pays the normal payout times this percent, from the house pot. */
export const FREE_MATCH_PAYOUT_PERCENT = 50;
export const LOSS_CONSOLATION = 5;
export const LOSS_CONSOLATION_DAILY_CAP = 10;
/** A broke player with no free matches left is topped up to this once a day. */
export const BROKE_RESCUE_TARGET = 60;

/**
 * Lucky wheel (docs/logic/economy.md §Lucky wheel, D165): a typed prize table. Each slice has a `kind` (coins, gems, hint tokens
 * or an extra spin), an `amount` and a weight; the admin edits the live table, this is the seed used when it is empty. The admin can
 * also scale the coin prizes with `wheel.prize_scale_percent`. Expected ≈ 9 coins plus the other kinds per spin (needs the economy
 * simulation before launch).
 */
export const WHEEL_PRIZE_KINDS = ['coins', 'gems', 'hint_token', 'wheel_spin', 'cosmetic'] as const;
export type WheelPrizeKind = (typeof WHEEL_PRIZE_KINDS)[number];
export const WHEEL_SLICES_DEFAULT: readonly { kind: WheelPrizeKind; amount: number; weight: number }[] = [
  { kind: 'coins', amount: 5, weight: 24 },
  { kind: 'hint_token', amount: 1, weight: 12 },
  { kind: 'coins', amount: 10, weight: 20 },
  { kind: 'gems', amount: 1, weight: 10 },
  { kind: 'coins', amount: 15, weight: 14 },
  { kind: 'coins', amount: 20, weight: 9 },
  { kind: 'wheel_spin', amount: 1, weight: 4 },
  { kind: 'coins', amount: 40, weight: 3 },
  { kind: 'gems', amount: 3, weight: 3 },
  { kind: 'coins', amount: 100, weight: 1 },
];

/**
 * Economy v2 (docs/logic/economy-v2.md, D204, proposed). Nothing here is wired to the live game yet; the balance simulator
 * (`simulateEconomyV2`) reads it first so the numbers are checked before they are built.
 */
export interface StakeTier {
  id: string;
  /** Entry fee per player, coins. */
  fee: number;
  /** Lowest player level that may sit at this table. */
  minLevel: number;
}
export const STAKE_TIERS: readonly StakeTier[] = [
  { id: 'bronze', fee: ENTRY_FEE_BASE, minLevel: DUEL_MIN_LEVEL },
  { id: 'silver', fee: 100, minLevel: 8 },
  { id: 'gold', fee: 500, minLevel: 15 },
];
/** Share of a friend gift burned by the house, percent. */
export const GIFT_FEE_PERCENT = 5;
/** Soft daily ceiling on coins from non-skill faucets (daily reward, daily puzzle, wheel, missions). 0 = no cap. */
export const NON_SKILL_DAILY_CAP = 40;
/** Streak shield: protects the daily-reward streak across one missed day. */
export const STREAK_SHIELD_PRICE = 30;
export const STREAK_SHIELD_MAX_HELD = 2;
/** Rotating shop items offered per Tehran day (setting `shop.daily_slots`; 0 = every rotating item is always on offer). */
export const DAILY_SHOP_SLOTS = 4;
/** Daily rotating shop: coin prices of the slots offered each Tehran day. */
export const DAILY_SHOP_COIN_PRICES: readonly number[] = [40, 90, 180, 350];
/** Keepsake collection («یادگار», pieces called «تکه»). */
export const KEEPSAKE_PIECES = 4;
export const KEEPSAKE_PIECE_SHOP_PRICE = 60;
/** Chance a human-vs-human win drops one piece. */
export const KEEPSAKE_DROP_CHANCE = 0.15;
/** Coins to upgrade one completed keepsake one level (up to `KEEPSAKE_MAX_LEVEL`). */
export const KEEPSAKE_UPGRADE_COST = 150;
export const KEEPSAKE_MAX_LEVEL = 3;
