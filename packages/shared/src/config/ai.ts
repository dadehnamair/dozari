/** Limits of the admin «AI studio» (docs/logic/ai-studio.md). Content only; no player-facing number lives here. */
export const AI_KINDS = ['products', 'kid_lessons', 'puzzle_titles', 'blog'] as const;
export type AiKind = (typeof AI_KINDS)[number];

export const AI_LIMITS = {
  /** Most drafts one request may ask for, per kind. */
  maxCount: { products: 20, kid_lessons: 20, puzzle_titles: 1, blog: 3 } as Record<AiKind, number>,
  /** Generations (provider calls) per hour for the whole server; the provider bills us for each. */
  maxCallsPerHour: 30,
  /** Seconds before a provider call is given up. */
  timeoutSeconds: 90,
  /** Longest free-text hint an admin may add (theme, topic, extra instructions). */
  maxHintLength: 300,
  /** Output token ceiling per kind. */
  maxTokens: { products: 3000, kid_lessons: 3000, puzzle_titles: 800, blog: 6000 } as Record<AiKind, number>,
} as const;

/** Blog length choices → rough Persian word target given to the model. */
export const AI_BLOG_LENGTHS = { short: 300, medium: 600, long: 1000 } as const;
export type AiBlogLength = keyof typeof AI_BLOG_LENGTHS;
