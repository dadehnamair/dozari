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

/** Coin reward of reaching `level` on the road: every `every`-th level pays `base × (level / every)`; 0 elsewhere or when off. */
export function levelRewardCoins(level: number, every: number, base: number): number {
  if (every <= 0 || base <= 0 || level < 1 || level % every !== 0) return 0;
  return base * (level / every);
}

/** The reward levels of a road in ascending order. */
export function rewardLevels(levelMax: number, every: number): number[] {
  if (every <= 0) return [];
  const out: number[] = [];
  for (let l = every; l <= levelMax; l += every) out.push(l);
  return out;
}

export const levelRewardSchema = z.object({
  level: z.number().int().positive(),
  coins: z.number().int().positive(),
  claimed: z.boolean(),
});
export type LevelReward = z.infer<typeof levelRewardSchema>;

/** `POST /me/levels/claim`: the coins just paid for every reached, unclaimed reward. */
export const levelClaimSchema = z.object({
  ok: z.literal(true),
  levels: z.array(z.number().int().positive()),
  coins: z.number().int().nonnegative(),
  balance: z.number().int().nonnegative(),
});
export type LevelClaim = z.infer<typeof levelClaimSchema>;

/** `GET /me/levels` (D109): the caller's level, the XP curve and everything a level opens, for the level road. */
export const levelRoadSchema = z.object({
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
  xpInLevel: z.number().int().nonnegative(),
  xpForNext: z.number().int().nonnegative(),
  curveBase: z.number().int().positive(),
  levelMax: z.number().int().positive(),
  unlocks: z.array(unlockSchema),
  /** Coin rewards of the road, with whether this player already took each. */
  rewards: z.array(levelRewardSchema),
});
export type LevelRoad = z.infer<typeof levelRoadSchema>;
