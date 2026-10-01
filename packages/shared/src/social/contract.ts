import { z } from 'zod';

export const GENDERS = ['female', 'male'] as const;
export const genderSchema = z.enum(GENDERS);
export type Gender = z.infer<typeof genderSchema>;

/** XP and level of a player (docs/logic/progression.md). */
export const levelInfoSchema = z.object({
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
  xpInLevel: z.number().int().nonnegative(),
  xpForNext: z.number().int().nonnegative(),
});

export const playerStatsSchema = z.object({
  games: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  draws: z.number().int().nonnegative(),
});
export type PlayerStats = z.infer<typeof playerStatsSchema>;

export const citySchema = z.object({ id: z.string().uuid(), nameFa: z.string() });
export type City = z.infer<typeof citySchema>;

/** `GET /cities`: cities a player may pick. */
export const citiesSchema = z.object({ cities: z.array(citySchema) });

/** How the caller stands with a player: nothing, request sent by me, request received from them, or friends. */
export const friendRelationSchema = z.enum(['none', 'sent', 'received', 'friends']);
export type FriendRelation = z.infer<typeof friendRelationSchema>;

/** `GET /players/:id` (D67). No bot flag exists anywhere in this shape: bots look like players. Gender is private. */
export const playerProfileSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string(),
  avatarKey: z.string(),
  level: z.number().int().positive(),
  coins: z.number().int().nonnegative(),
  stats: playerStatsSchema,
  cityName: z.string().nullable(),
  memberSince: z.number().int(),
  relation: friendRelationSchema,
  isMe: z.boolean(),
});
export type PlayerProfile = z.infer<typeof playerProfileSchema>;

/** `GET /me/profile`: the caller's own settings. */
export const myProfileSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string(),
  avatarKey: z.string(),
  gender: genderSchema.nullable(),
  city: citySchema.nullable(),
  /** Optional, private, never shown to other players. */
  email: z.string().nullable(),
  level: levelInfoSchema,
  stats: playerStatsSchema,
  /** The nickname rules in force, so the app can tell the player what is allowed. */
  nicknameRules: z.object({ minLen: z.number().int(), maxLen: z.number().int(), allowDigits: z.boolean(), allowLatin: z.boolean(), allowPersian: z.boolean() }),
  /** Why the nickname cannot be changed right now (not enough games), or null when it can. */
  nicknameLockedUntilGames: z.number().int().nonnegative().nullable(),
});
export type MyProfile = z.infer<typeof myProfileSchema>;

const playerRow = z.object({ id: z.string().uuid(), nickname: z.string(), avatarKey: z.string() });
/** `GET /friends`: accepted friends and requests waiting for the caller's answer. */
export const friendsSchema = z.object({ friends: z.array(playerRow), incoming: z.array(playerRow) });
export type Friends = z.infer<typeof friendsSchema>;
