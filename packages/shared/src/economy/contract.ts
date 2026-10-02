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

/** Wire shape of `GET /wheel` (spins waiting + the slices to draw) and `POST /wheel/spin` (docs/logic/economy.md §Lucky wheel). */
export const wheelStatusSchema = z.object({
  enabled: z.boolean(),
  /** Spins earned by wins and not yet spun. */
  pending: z.number().int().nonnegative(),
  /** Coins on each slice, in drawing order. */
  slices: z.array(z.number().int().positive()),
  balance: z.number().int().nonnegative(),
});
export type WheelStatus = z.infer<typeof wheelStatusSchema>;

export const wheelSpinSchema = z.object({
  ok: z.literal(true),
  /** Slice the wheel stops on. */
  slice: z.number().int().nonnegative(),
  coins: z.number().int().positive(),
  pending: z.number().int().nonnegative(),
  balance: z.number().int().nonnegative(),
});
export type WheelSpin = z.infer<typeof wheelSpinSchema>;
