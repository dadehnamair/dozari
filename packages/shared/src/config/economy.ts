/** Coin economy numbers (CLAUDE.md rule 9; docs/logic/economy.md). Proposed defaults, tunable. */

/** Daily reward: one claim per cooldown, a streak that grows by day and breaks when a whole day is skipped. */
export const DAILY_REWARD_COOLDOWN_HOURS = 24;
/** A claim within this many hours of the previous one continues the streak; later ones start again at day 1. */
export const DAILY_REWARD_STREAK_WINDOW_HOURS = 48;
/** Coins for day 1, 2, 3 … of a streak. Editable from the admin panel; after the last day the last amount repeats. */
export const DEFAULT_DAILY_REWARD_STEPS: readonly number[] = [10, 15, 20];
export const MAX_DAILY_REWARD_DAYS = 60;
export const MAX_DAILY_REWARD_COINS = 10_000;
