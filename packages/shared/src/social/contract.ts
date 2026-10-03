import { z } from 'zod';
import { publicBadgesSchema } from '../badges/contract.js';

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

/** `province` keys `PROVINCES` (D101); null = no regional identity («شهر دیگر»). */
export const citySchema = z.object({ id: z.string().uuid(), nameFa: z.string(), province: z.string().nullable() });
export type City = z.infer<typeof citySchema>;

/** `GET /cities`: cities a player may pick. */
export const citiesSchema = z.object({ cities: z.array(citySchema) });

/** Leaderboard scopes (D108): everyone, the caller's city, the caller's friends. Ranked by total XP. */
export const LEADERBOARD_SCOPES = ['all', 'city', 'friends'] as const;
export const leaderboardScopeSchema = z.enum(LEADERBOARD_SCOPES);
export type LeaderboardScope = z.infer<typeof leaderboardScopeSchema>;
export const LEADERBOARD_SIZE = 20;

/** Time window of the XP being ranked: all time, the last 7 days, the last 30 days (rolling windows). */
export const LEADERBOARD_PERIODS = ['all', 'week', 'month'] as const;
export const leaderboardPeriodSchema = z.enum(LEADERBOARD_PERIODS);
export type LeaderboardPeriod = z.infer<typeof leaderboardPeriodSchema>;
export const PERIOD_DAYS: Record<LeaderboardPeriod, number | null> = { all: null, week: 7, month: 30 };

export const leaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  id: z.string().uuid(),
  nickname: z.string(),
  avatarKey: z.string(),
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
  /** Province key of the player's city (D101), for the badge. */
  province: z.string().nullable(),
  isMe: z.boolean(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

/** `GET /leaderboard?scope=`: the top of the scope plus the caller's own place (null when the scope does not apply, e.g. no city). */
export const leaderboardSchema = z.object({
  scope: leaderboardScopeSchema,
  period: leaderboardPeriodSchema.default('all'),
  entries: z.array(leaderboardEntrySchema),
  me: z.object({ rank: z.number().int().positive(), xp: z.number().int().nonnegative(), level: z.number().int().positive() }).nullable(),
  /** False only for the city scope when the caller has not picked a city (an empty city board with a city set means nobody there has XP yet). */
  hasCity: z.boolean().default(true),
});
export type Leaderboard = z.infer<typeof leaderboardSchema>;

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
  /** Province key of that city, for the badge next to it. */
  cityProvince: z.string().nullable(),
  badges: publicBadgesSchema,
  memberSince: z.number().int(),
  relation: friendRelationSchema,
  isMe: z.boolean(),
  /** Has the app open right now (a live socket). */
  online: z.boolean().default(false),
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
export const friendsSchema = z.object({ friends: z.array(playerRow.extend({ online: z.boolean().default(false) })), incoming: z.array(playerRow) });
export type Friends = z.infer<typeof friendsSchema>;

/** `GET /me/games`: the player's last finished games, newest first («بازی‌های اخیر» on the profile). */
export const recentGamesSchema = z.object({
  games: z.array(z.object({ mode: z.enum(['solo', 'duel']).nullable(), outcome: z.enum(['win', 'loss', 'draw']).nullable(), xp: z.number().int().nonnegative(), at: z.number().int() })),
});
export type RecentGames = z.infer<typeof recentGamesSchema>;
