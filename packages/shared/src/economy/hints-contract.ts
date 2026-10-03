import { z } from 'zod';
import { HINT_KINDS } from '../config/economy.js';

export const hintKindSchema = z.enum(HINT_KINDS);

const level = z.number().int().min(0).max(3);
export const hintPayloadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('group_title'), level, titleFa: z.string() }),
  z.object({ kind: z.literal('one_card'), level, productId: z.string() }),
  z.object({ kind: z.literal('pair'), level, productIds: z.tuple([z.string(), z.string()]) }),
]);

/** `GET /solo/:id/hints`: what a hint costs now, whether the player may take one, and what was already revealed. */
export const soloHintsSchema = z.object({
  options: z.array(z.object({ kind: hintKindSchema, price: z.number().int().nonnegative() })),
  used: z.number().int().nonnegative(),
  max: z.number().int().positive(),
  minLevel: z.number().int().positive(),
  level: z.number().int().positive(),
  balance: z.number().int().nonnegative(),
  /** Hint tokens owned; a token pays for a hint instead of coins. */
  tokens: z.number().int().nonnegative(),
  blocked: z.enum(['LEVEL', 'LIMIT']).nullable(),
  given: z.array(hintPayloadSchema),
});
export type SoloHints = z.infer<typeof soloHintsSchema>;

export const soloHintResultSchema = z.object({
  hint: hintPayloadSchema,
  paidWith: z.enum(['coins', 'token']),
  balance: z.number().int().nonnegative(),
  tokens: z.number().int().nonnegative(),
});
export type SoloHintResult = z.infer<typeof soloHintResultSchema>;

/** `GET /shop`: items a player can buy with coins (docs/logic/shop.md). */
/** `hint_token` adds hint tokens; `wheel_spin` adds lucky-wheel spins (one row per spin in `wheel_spins`). */
export const SHOP_EFFECTS = ['hint_token', 'wheel_spin', 'cosmetic'] as const;
export const COSMETIC_SLOTS = ['hat', 'outfit', 'accessory'] as const;
export const shopEffectSchema = z.enum(SHOP_EFFECTS);

export const shopItemSchema = z.object({
  id: z.string().uuid(),
  titleFa: z.string(),
  descriptionFa: z.string(),
  effect: shopEffectSchema,
  /** Units of the effect one purchase grants (e.g. 5 hint tokens). */
  amount: z.number().int().positive(),
  /** Currency that pays for it; only the matching price counts. */
  currency: z.enum(['coins', 'gems']).default('coins'),
  priceCoins: z.number().int().nonnegative(),
  priceGems: z.number().int().nonnegative().default(0),
  minLevel: z.number().int().positive(),
  iconKey: z.string().nullable(),
  /** Slot a cosmetic is worn in (null for other effects). */
  slot: z.enum(COSMETIC_SLOTS).nullable().default(null),
  /** Cosmetics: the caller owns it / wears it. */
  owned: z.boolean().default(false),
  equipped: z.boolean().default(false),
  /** Why the player cannot buy it right now, or null. */
  blocked: z.enum(['LEVEL', 'DAILY_LIMIT', 'COINS', 'GEMS', 'OWNED']).nullable(),
  /** Purchases left today when the item has a daily limit. */
  leftToday: z.number().int().nonnegative().nullable(),
});
export type ShopItem = z.infer<typeof shopItemSchema>;

export const shopSchema = z.object({
  items: z.array(shopItemSchema),
  balance: z.number().int().nonnegative(),
  gems: z.number().int().nonnegative().default(0),
  level: z.number().int().positive(),
  tokens: z.number().int().nonnegative(),
});
export type Shop = z.infer<typeof shopSchema>;
