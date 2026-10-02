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
