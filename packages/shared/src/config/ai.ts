/** Limits of the admin «AI studio» (docs/logic/ai-studio.md). Content only; no player-facing number lives here. */
export const AI_KINDS = ['products', 'kid_lessons', 'puzzle_titles', 'puzzle_groups', 'blog'] as const;
export type AiKind = (typeof AI_KINDS)[number];

export const AI_LIMITS = {
  /** Most drafts one request may ask for, per kind. */
  maxCount: { products: 20, kid_lessons: 20, puzzle_titles: 1, puzzle_groups: 3, blog: 3 } as Record<AiKind, number>,
  /** Generations (provider calls) per hour for the whole server; the provider bills us for each. */
  maxCallsPerHour: 30,
  /** Seconds before a provider call is given up. */
  timeoutSeconds: 90,
  /** Longest free-text hint an admin may add (theme, topic, extra instructions). */
  maxHintLength: 300,
  /** Existing catalog product names sent to the model as «do not repeat» (products), and existing puzzles it must not repeat (puzzle_groups). */
  maxExistingNames: 3000,
  maxExistingPuzzles: 150,
  /** Output token ceiling per kind. */
  maxTokens: { products: 8000, kid_lessons: 5000, puzzle_titles: 3000, puzzle_groups: 8000, blog: 10000 } as Record<AiKind, number>,
} as const;

/** Products offered to the model when it builds whole puzzles (names only; the rest of the catalog is left out to bound the prompt). */
export const AI_PUZZLE_CATALOG_MAX = 300;

/** Blog length choices → rough Persian word target given to the model. */
export const AI_BLOG_LENGTHS = { short: 300, medium: 600, long: 1000 } as const;
export type AiBlogLength = keyof typeof AI_BLOG_LENGTHS;

/** Scheduled AI runs (docs/logic/ai-studio.md §Schedules). Iran has no daylight saving since 2022, so a fixed offset is right. */
export const AI_SCHEDULE_KINDS = ['products', 'kid_lessons', 'puzzle_groups', 'blog'] as const satisfies readonly AiKind[];
export type AiScheduleKind = (typeof AI_SCHEDULE_KINDS)[number];

export const AI_SCHEDULE_LIMITS = {
  /** Cron expressions are read in Tehran time. */
  tzOffsetMinutes: 210,
  /** Most schedules the panel keeps. */
  maxSchedules: 20,
  /** A schedule may not fire more often than this (every run is a billed provider call). */
  minIntervalMinutes: 15,
  /** How often the server looks for due schedules. */
  tickSeconds: 60,
  /** Longest message kept as the result of the last run. */
  maxMessageLength: 300,
} as const;
