import { z } from 'zod';
import { TRIVIA_DIFFICULTY_DEFAULT, TRIVIA_OPTION_COUNT, TRIVIA_OPTION_MAX, TRIVIA_TEXT_MAX } from '../config/topics.js';

/** A general (non-price) question with four choices, always filed under a topic (docs/logic/trivia.md). */
export const triviaInputSchema = z
  .object({
    topicId: z.string().uuid(),
    textFa: z.string().trim().min(5).max(TRIVIA_TEXT_MAX),
    options: z.array(z.string().trim().min(1).max(TRIVIA_OPTION_MAX)).length(TRIVIA_OPTION_COUNT),
    correctIndex: z.number().int().min(0).max(TRIVIA_OPTION_COUNT - 1),
    explanationFa: z.string().trim().max(TRIVIA_TEXT_MAX).default(''),
    ageTrack: z.enum(['kid', 'teen', 'adult']).default('adult'),
    /** 1 easy · 2 medium · 3 hard (docs/logic/trivia.md §Difficulty). */
    difficulty: z.number().int().min(1).max(3).default(TRIVIA_DIFFICULTY_DEFAULT),
  })
  .refine((q) => new Set(q.options.map((o) => o.replace(/\s+/g, ' ').toLowerCase())).size === TRIVIA_OPTION_COUNT, { message: 'options must be different', path: ['options'] });
export type TriviaInput = z.infer<typeof triviaInputSchema>;

/** One question as the player sees it: the choices already shuffled, never which one is right. */
export const triviaRoundSchema = z.object({
  index: z.number().int().nonnegative(),
  textFa: z.string(),
  options: z.array(z.string()).length(TRIVIA_OPTION_COUNT),
  topicNameFa: z.string(),
});

export const triviaResultSchema = z.object({
  index: z.number().int().nonnegative(),
  pickedIndex: z.number().int().min(0).max(TRIVIA_OPTION_COUNT - 1),
  correctIndex: z.number().int().min(0).max(TRIVIA_OPTION_COUNT - 1),
  correct: z.boolean(),
  explanationFa: z.string().nullable(),
  /** The designer's nickname when a player wrote the question. */
  authorFa: z.string().nullable().default(null),
});

export const triviaViewSchema = z.object({
  sessionId: z.string(),
  /** The topic the game was started for; null = a mix of topics. */
  topicNameFa: z.string().nullable(),
  rounds: z.array(triviaRoundSchema),
  /** Answers given so far; the right choice is revealed only here, after the answer. */
  results: z.array(triviaResultSchema),
  done: z.boolean(),
  score: z.number().int().nonnegative(),
  /** Coins the game cost (0 = free or an anonymous game) and, once done, how many came back. */
  fee: z.number().int().nonnegative().default(0),
  refund: z.number().int().nonnegative().default(0),
});
export type TriviaRound = z.infer<typeof triviaRoundSchema>;
export type TriviaResult = z.infer<typeof triviaResultSchema>;
export type TriviaView = z.infer<typeof triviaViewSchema>;

/** Topics a player can start a game on, with how many questions each has. */
export const triviaTopicsSchema = z.object({ topics: z.array(z.object({ id: z.string().uuid(), nameFa: z.string(), /** Icon of the pack chosen in the admin; the app falls back to its own per-name icon. */ iconKey: z.string().nullable().optional(), questions: z.number().int().nonnegative() })) });
export type TriviaTopics = z.infer<typeof triviaTopicsSchema>;
