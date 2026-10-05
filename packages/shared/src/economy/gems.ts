import { z } from 'zod';

/** Why gems moved (mirrors `GEM_REASONS` of the DB; docs/logic/economy.md §Gems, D164). */
export const GEM_REASON_KEYS = ['admin_adjust', 'birthday_gift', 'wheel_prize', 'shop_purchase', 'tournament_entry', 'tournament_refund', 'tournament_prize', 'mission_reward'] as const;
export type GemReason = (typeof GEM_REASON_KEYS)[number];

/** `GET /me/gems`: the balance and the newest movements. */
export const gemWalletSchema = z.object({
  balance: z.number().int().nonnegative(),
  items: z.array(z.object({ id: z.string(), delta: z.number().int(), reason: z.enum(GEM_REASON_KEYS), createdAt: z.number().int() })),
});
export type GemWallet = z.infer<typeof gemWalletSchema>;
