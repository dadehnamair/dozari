import { z } from 'zod';

/** What a level opens. The first five come from admin settings (one gate each); `shop` is one per shop item. */
export const UNLOCK_KINDS = ['hint', 'invite', 'transfer', 'avatar', 'nickname', 'shop'] as const;
export type UnlockKind = (typeof UNLOCK_KINDS)[number];

export const unlockSchema = z.object({
  level: z.number().int().positive(),
  kind: z.enum(UNLOCK_KINDS),
  /** Only for `shop`: the item's own title and icon (content, edited in the admin panel). */
  titleFa: z.string().nullable(),
  iconKey: z.string().nullable(),
});
export type Unlock = z.infer<typeof unlockSchema>;

/** `GET /me/levels` (D109): the caller's level, the XP curve and everything a level opens, for the level road. */
export const levelRoadSchema = z.object({
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
  xpInLevel: z.number().int().nonnegative(),
  xpForNext: z.number().int().nonnegative(),
  curveBase: z.number().int().positive(),
  levelMax: z.number().int().positive(),
  unlocks: z.array(unlockSchema),
});
export type LevelRoad = z.infer<typeof levelRoadSchema>;
