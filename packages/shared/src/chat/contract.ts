import { z } from 'zod';

export const CHAT_ROOMS = ['city', 'match'] as const;

export const chatMessageSchema = z.object({
  id: z.string().uuid(),
  room: z.enum(CHAT_ROOMS),
  /** `table`: a shared private table; `text` is `<CODE>|<emoji> <name>`. */
  kind: z.enum(['text', 'taunt', 'table']),
  text: z.string(),
  userId: z.string().uuid(),
  nickname: z.string(),
  avatarKey: z.string(),
  /** Title of the badge the sender shows, if any. */
  badge: z.string().nullable(),
  createdAt: z.number().int(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatHistorySchema = z.object({
  cityName: z.string().nullable(),
  messages: z.array(chatMessageSchema),
  /** Whether this player may type free text (activated account, not muted); taunts are always allowed unless muted. */
  canType: z.boolean(),
  muted: z.object({ until: z.number().int(), reason: z.string() }).nullable(),
});
export type ChatHistory = z.infer<typeof chatHistorySchema>;

export const tauntCategorySchema = z.object({
  id: z.string().uuid(),
  nameFa: z.string(),
  taunts: z.array(z.object({ id: z.string().uuid(), text: z.string() })),
});
export const tauntsSchema = z.object({ categories: z.array(tauntCategorySchema) });
export type TauntCategory = z.infer<typeof tauntCategorySchema>;

export const CHAT_ERRORS = ['NO_CITY', 'NEEDS_ACTIVATION', 'MUTED', 'RATE_LIMITED', 'CONTACT_BLOCKED', 'FILTERED', 'TOO_LONG', 'EMPTY', 'UNKNOWN_TAUNT', 'NOT_IN_MATCH', 'NOT_FOUND', 'OFF'] as const;
export type ChatError = (typeof CHAT_ERRORS)[number];

/** Socket `chat:taunt`: a canned taunt to the opponent of the current duel. */
export const chatTauntSchema = z.object({ tauntId: z.string().uuid() });
