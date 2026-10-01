import { z } from 'zod';

/** `GET /me/invite`: the player's own code, how it is doing, and the rules (all numbers come from admin settings). */
export const myInviteSchema = z.object({
  /** Null until the player reaches `minLevel`. */
  code: z.string().nullable(),
  minLevel: z.number().int().positive(),
  level: z.number().int().positive(),
  uses: z.number().int().nonnegative(),
  maxUses: z.number().int().positive(),
  /** Invited players whose reward was already paid / are still waiting for their games. */
  rewarded: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  /** Has this player redeemed a code (it activates chat, renaming and gifts). */
  activated: z.boolean(),
  rules: z.object({ inviteeBonus: z.number().int(), inviterReward: z.number().int(), rewardAfterGames: z.number().int() }),
});
export type MyInvite = z.infer<typeof myInviteSchema>;

export const redeemResultSchema = z.object({ bonus: z.number().int().nonnegative(), balance: z.number().int().nonnegative() });
export type RedeemResult = z.infer<typeof redeemResultSchema>;

export const REDEEM_ERRORS = ['invalid', 'own_code', 'already_redeemed', 'exhausted', 'inactive', 'rate_limited'] as const;
export type RedeemError = (typeof REDEEM_ERRORS)[number];
