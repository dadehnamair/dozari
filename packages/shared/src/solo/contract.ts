import { z } from 'zod';

/**
 * Wire contract of solo practice (`/solo/*`, docs/logic/game-rules.md §Solo). The server builds
 * these from its private state and the client parses what it receives with the same schemas.
 * Nothing here may carry an unsolved group's membership or text (rule 4).
 */
const level = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

export const soloCardSchema = z.object({
  id: z.string(),
  nameFa: z.string(),
  unitFa: z.string().nullable(),
});

export const soloSolvedGroupSchema = z.object({
  level,
  titleFa: z.string(),
  explanationFa: z.string(),
  productIds: z.array(z.string()),
  /** Shown by the game (auto-reveal / game over) rather than found by the player. */
  revealed: z.boolean(),
});

export const soloViewSchema = z.object({
  sessionId: z.string(),
  puzzleId: z.string(),
  cards: z.array(soloCardSchema),
  solved: z.array(soloSolvedGroupSchema),
  mistakes: z.number().int().nonnegative(),
  maxMistakes: z.number().int().positive(),
  status: z.enum(['playing', 'won', 'lost']),
});

export const soloGuessResultSchema = z.object({
  outcome: z.enum(['correct', 'one_away', 'wrong', 'duplicate', 'invalid']),
  solvedLevel: level.optional(),
  view: soloViewSchema,
});

export type SoloCard = z.infer<typeof soloCardSchema>;
export type SoloSolvedGroup = z.infer<typeof soloSolvedGroupSchema>;
export type SoloView = z.infer<typeof soloViewSchema>;
export type SoloGuessResult = z.infer<typeof soloGuessResultSchema>;

/**
 * Price history shown on the result screen. Only served once the game is over (never while playing,
 * because the groups' contents would leak the solution). Prices are integer rials as decimal strings.
 */
export const soloChartSchema = z.object({
  groups: z.array(
    z.object({
      level,
      titleFa: z.string(),
      /** Year the group's rule refers to (drawn as a dashed marker), if any. */
      ruleYear: z.number().int().optional(),
      items: z.array(
        z.object({
          productId: z.string(),
          nameFa: z.string(),
          points: z.array(z.object({ year: z.number().int(), month: z.number().int().nullable(), priceRials: z.string().regex(/^\d+$/) })),
        }),
      ),
    }),
  ),
});

export type SoloChart = z.infer<typeof soloChartSchema>;
