import { z } from 'zod';
import { KEEPSAKE_RARITIES, SHOWCASE_MAX } from '../config/economy.js';

/** One keepsake as a player sees it (`GET /keepsakes`). The art itself comes from `artKey` (supplied by the owner's designer). */
export const keepsakeViewSchema = z.object({
  id: z.string().uuid(),
  titleFa: z.string(),
  storyFa: z.string(),
  /** Solar Hijri year of the product's era, when known. */
  eraYear: z.number().int().nullable(),
  rarity: z.enum(KEEPSAKE_RARITIES),
  /** Number of pieces and the numbers the player owns. */
  pieces: z.number().int().positive(),
  owned: z.array(z.number().int().positive()),
  complete: z.boolean(),
  /** 1..max once completed, else 0. */
  level: z.number().int().nonnegative(),
  /** Designer art key (null = placeholder frame) and the catalog icon of the product. */
  artKey: z.string().nullable(),
  iconKey: z.string().nullable(),
  setId: z.string().uuid().nullable(),
  /** Coins for one more piece in the shop, and for the next upgrade (null when complete / at the top). */
  piecePrice: z.number().int().nonnegative(),
  upgradePrice: z.number().int().positive().nullable(),
  rewardGems: z.number().int().nonnegative(),
  /** Position on the showcase (1..SHOWCASE_MAX) or null. */
  showcaseSlot: z.number().int().min(1).max(SHOWCASE_MAX).nullable(),
});
export type KeepsakeView = z.infer<typeof keepsakeViewSchema>;

export const keepsakeSetViewSchema = z.object({
  id: z.string().uuid(),
  titleFa: z.string(),
  total: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  rewardGems: z.number().int().nonnegative(),
});

export const keepsakeGallerySchema = z.object({
  items: z.array(keepsakeViewSchema),
  sets: z.array(keepsakeSetViewSchema),
  completed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  percent: z.number().int().min(0).max(100),
  balance: z.number().int().nonnegative(),
});
export type KeepsakeGallery = z.infer<typeof keepsakeGallerySchema>;

/** `PUT /me/showcase` */
export const showcaseBodySchema = z.object({ ids: z.array(z.string().uuid()).max(SHOWCASE_MAX) });

/** What another player sees on the profile (`GET /players/:id/showcase`): the pinned keepsakes and the totals. */
export const showcaseViewSchema = z.object({
  items: z.array(keepsakeViewSchema.pick({ id: true, titleFa: true, rarity: true, level: true, artKey: true, iconKey: true, eraYear: true })),
  completed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  percent: z.number().int().min(0).max(100),
});
export type ShowcaseView = z.infer<typeof showcaseViewSchema>;
