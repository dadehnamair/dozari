import { z } from 'zod';

/** What a player's app tells the server when something breaks (a crash, a failed screen, or «report a problem» by hand). docs/logic/client-errors.md */
export const CLIENT_ERROR_KINDS = ['crash', 'screen', 'manual'] as const;
export type ClientErrorKind = (typeof CLIENT_ERROR_KINDS)[number];

/** A screenshot comes as a `data:image/(jpeg|webp|png);base64,…` string; the server refuses anything bigger than this many characters. */
export const CLIENT_ERROR_SHOT_MAX = 700_000;

export const clientErrorInputSchema = z.object({
  kind: z.enum(CLIENT_ERROR_KINDS),
  /** The screen the player was on («home», «solo», «duel»…). */
  screen: z.string().max(64).default(''),
  message: z.string().max(500).default(''),
  /** Stack and component stack, trimmed. */
  detail: z.string().max(6000).default(''),
  /** One line of device facts: platform, app version, track, user agent, online state, time zone… */
  context: z.string().max(1500).default(''),
  /** What the player typed in «what happened?» (manual reports). */
  note: z.string().max(500).default(''),
  screenshot: z
    .string()
    .max(CLIENT_ERROR_SHOT_MAX)
    .regex(/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
});
export type ClientErrorInput = z.infer<typeof clientErrorInputSchema>;

export const clientErrorRowSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  userName: z.string().nullable(),
  kind: z.enum(CLIENT_ERROR_KINDS),
  screen: z.string(),
  message: z.string(),
  detail: z.string(),
  context: z.string(),
  note: z.string(),
  hasScreenshot: z.boolean(),
  createdAt: z.number(),
  resolved: z.boolean(),
});
export type ClientErrorRow = z.infer<typeof clientErrorRowSchema>;
