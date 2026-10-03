import { z } from 'zod';
import { WHEEL_PRIZE_KINDS } from '../config/economy.js';

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

export const wheelPrizeSchema = z.object({ kind: z.enum(WHEEL_PRIZE_KINDS), amount: z.number().int().positive() });
export type WheelPrize = z.infer<typeof wheelPrizeSchema>;

/** Wire shape of `GET /wheel` (spins waiting + the slices to draw) and `POST /wheel/spin` (docs/logic/economy.md §Lucky wheel). */
export const wheelStatusSchema = z.object({
  enabled: z.boolean(),
  /** Spins waiting (earned by wins, bought, won as prizes or given daily) and not yet spun. */
  pending: z.number().int().nonnegative(),
  /** Free spins this request just added for today (0 when already taken or none are given). */
  daily: z.number().int().nonnegative().default(0),
  /** Prize on each slice, in drawing order. */
  slices: z.array(wheelPrizeSchema),
  balance: z.number().int().nonnegative(),
  gems: z.number().int().nonnegative().default(0),
});
export type WheelStatus = z.infer<typeof wheelStatusSchema>;

export const wheelSpinSchema = z.object({
  ok: z.literal(true),
  /** Slice the wheel stops on. */
  slice: z.number().int().nonnegative(),
  /** What was won, by kind (`amount` coins, gems, hint tokens or spins). */
  kind: z.enum(WHEEL_PRIZE_KINDS).default('coins'),
  amount: z.number().int().positive(),
  pending: z.number().int().nonnegative(),
  balance: z.number().int().nonnegative(),
  gems: z.number().int().nonnegative().default(0),
});
export type WheelSpin = z.infer<typeof wheelSpinSchema>;
