import { z } from 'zod';

export const GENDERS = ['female', 'male'] as const;
export const genderSchema = z.enum(GENDERS);
export type Gender = z.infer<typeof genderSchema>;

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
});
export type MyProfile = z.infer<typeof myProfileSchema>;

const playerRow = z.object({ id: z.string().uuid(), nickname: z.string(), avatarKey: z.string() });
/** `GET /friends`: accepted friends and requests waiting for the caller's answer. */
export const friendsSchema = z.object({ friends: z.array(playerRow), incoming: z.array(playerRow) });
export type Friends = z.infer<typeof friendsSchema>;
