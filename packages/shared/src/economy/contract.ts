import { z } from 'zod';

/** Wire shape of `GET /daily-reward` (the card) and `POST /daily-reward/claim` (docs/logic/economy.md). */
export const dailyRewardStatusSchema = z.object({
  canClaim: z.boolean(),
  day: z.number().int().positive(),
  coins: z.number().int().nonnegative(),
  nextClaimAt: z.number().int().nullable(),
  steps: z.array(z.number().int().positive()),
  balance: z.number().int().nonnegative(),
});
export type DailyRewardStatus = z.infer<typeof dailyRewardStatusSchema>;

export const dailyRewardClaimSchema = z.object({
  ok: z.literal(true),
  day: z.number().int().positive(),
  coins: z.number().int().positive(),
  balance: z.number().int().nonnegative(),
  nextClaimAt: z.number().int(),
});
export type DailyRewardClaim = z.infer<typeof dailyRewardClaimSchema>;
