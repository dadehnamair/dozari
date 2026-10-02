import { z } from 'zod';
import { isDateKey } from './pick.js';

export const dateKeySchema = z.string().refine(isDateKey, 'bad date');

/** `GET /daily-puzzle`: today's card on Home. Never carries the puzzle's content before the game starts. */
export const dailyStatusSchema = z.object({
  dateKey: z.string(),
  /** Occasion/trend title shown on the card, or null for a plain day. */
  themeTitleFa: z.string().nullable(),
  state: z.enum(['available', 'playing', 'won', 'lost', 'unavailable']),
  rewardCoins: z.number().int().nonnegative(),
  streak: z.number().int().nonnegative(),
});
export type DailyStatus = z.infer<typeof dailyStatusSchema>;
