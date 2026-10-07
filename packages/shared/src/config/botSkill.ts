/**
 * Bot skill by level (docs/logic/bots.md §Skill by level). One row per skill band; the bands follow the puzzle tiers of
 * `DEFAULT_PUZZLE_TIERS` (1-3, 4-8, 9-15, 16-25, 26+) so a bot's strength matches the puzzles of its level.
 * All numbers are proposed defaults, to be tuned with playtests.
 */
export interface BotSkillBand {
  /** First level of the band (rows sorted ascending). */
  minLevel: number;
  /** Chance (percent) the bot submits a real group before the per-bot skill nudge. */
  accuracyPercent: number;
  /** Of the misses, chance (percent) of a "one away" pick (three right plus an intruder) instead of a blind guess. */
  nearMissPercent: number;
  /** Multiplier (percent) on the bot's own think-time range: low levels are slower. */
  thinkScalePercent: number;
  /** Largest price-guess error (percent of the real price) in the price round. */
  priceMaxErrorPercent: number;
}

export const BOT_SKILL_BANDS: readonly BotSkillBand[] = [
  { minLevel: 1, accuracyPercent: 25, nearMissPercent: 30, thinkScalePercent: 180, priceMaxErrorPercent: 70 },
  { minLevel: 4, accuracyPercent: 40, nearMissPercent: 35, thinkScalePercent: 150, priceMaxErrorPercent: 55 },
  { minLevel: 9, accuracyPercent: 55, nearMissPercent: 35, thinkScalePercent: 120, priceMaxErrorPercent: 40 },
  { minLevel: 16, accuracyPercent: 70, nearMissPercent: 30, thinkScalePercent: 100, priceMaxErrorPercent: 28 },
  { minLevel: 26, accuracyPercent: 84, nearMissPercent: 25, thinkScalePercent: 80, priceMaxErrorPercent: 15 },
];

/** The per-bot admin skill (0-100, neutral at `BOT_SKILL_NEUTRAL`) shifts accuracy by `BOT_SKILL_NUDGE_PER_POINT` points per point off neutral. */
export const BOT_SKILL_NEUTRAL = 50;
export const BOT_SKILL_NUDGE_PER_POINT = 0.25;
/** Hard bounds on the final accuracy: never hopeless, never perfect. */
export const BOT_ACCURACY_MIN_PERCENT = 8;
export const BOT_ACCURACY_MAX_PERCENT = 90;
/** The price error never shrinks below this (percent) however skilled, and shrinks/grows by `BOT_PRICE_ERROR_NUDGE_PER_POINT` percent per skill point off neutral. */
export const BOT_PRICE_ERROR_MIN_PERCENT = 5;
export const BOT_PRICE_ERROR_NUDGE_PER_POINT = 0.2;

/** Default chance (percent) of a one-away pick among a bot's misses when no level profile is given. */
export const BOT_NEAR_MISS_PERCENT = 35;
