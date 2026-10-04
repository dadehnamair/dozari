import { z } from 'zod';

/** What the player needs to tell two accounts apart when choosing between them. */
export const accountSummarySchema = z.object({
  nickname: z.string(),
  avatarKey: z.string(),
  level: z.number().int().positive(),
  coins: z.number().int().nonnegative(),
});
export type AccountSummary = z.infer<typeof accountSummarySchema>;

/**
 * The number just proven already belongs to another account: the player must choose (never merged, never silent).
 * `keep_current`: this account keeps the number, the old one loses it. `load_previous`: this device switches to the old account.
 */
export const phoneConflictSchema = z.object({
  phone: z.string(),
  current: accountSummarySchema,
  previous: accountSummarySchema,
});
export type PhoneConflict = z.infer<typeof phoneConflictSchema>;

export const PHONE_CHOICES = ['keep_current', 'load_previous'] as const;
export const phoneChoiceSchema = z.enum(PHONE_CHOICES);
export type PhoneChoice = z.infer<typeof phoneChoiceSchema>;

/** `GET /me/phone`: masked numbers only; the full number never goes back to the app. */
export const phoneStatusSchema = z.object({
  phone: z.string().nullable(),
  pending: z.string().nullable(),
  verified: z.boolean(),
  smsAvailable: z.boolean(),
  /** Set while a proven number waits for the player's choice. */
  conflict: phoneConflictSchema.nullable().default(null),
});
export type PhoneStatus = z.infer<typeof phoneStatusSchema>;

/** `POST /me/phone/resolve`: the new status, or (load_previous) a session for the old account to switch to. */
export const phoneResolveSchema = z.object({
  status: phoneStatusSchema.nullable(),
  session: z.object({ token: z.string(), user: z.object({ id: z.string(), nickname: z.string(), avatarKey: z.string() }) }).nullable(),
});
export type PhoneResolve = z.infer<typeof phoneResolveSchema>;
