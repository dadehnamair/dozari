import { z } from 'zod';
import { friendRelationSchema } from './contract.js';

export const foundPlayerSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string(),
  avatarKey: z.string(),
  relation: friendRelationSchema,
});
export type FoundPlayer = z.infer<typeof foundPlayerSchema>;

/** `GET /players/search?q=`: one exact match by public ID or verified phone, or null. Not-found and not-findable look identical. */
export const searchResultSchema = z.object({ player: foundPlayerSchema.nullable() });
export const contactsResultSchema = z.object({ players: z.array(foundPlayerSchema) });

/** `GET /me/find`: my public ID, whether my verified phone lets friends find me, and my invite link. */
export const myFindSchema = z.object({
  handle: z.string(),
  findableByPhone: z.boolean(),
  inviteUrl: z.string(),
  /** The shortened link when a shortener is configured and answered; else the same as `inviteUrl`. */
  shareUrl: z.string(),
});
export type MyFind = z.infer<typeof myFindSchema>;
