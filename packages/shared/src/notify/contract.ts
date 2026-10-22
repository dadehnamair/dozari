import { z } from 'zod';

/** `GET /bale/link`: is the Bale bot set up, and is this player linked. */
export const baleLinkStatusSchema = z.object({ configured: z.boolean(), linked: z.boolean(), botUsername: z.string().nullable(), /** The Telegram bot, when it is set up. */ telegramBotUsername: z.string().nullable().optional() });
/** `POST /bale/link-code`: the one-time code the player sends to the bot. */
export const baleLinkCodeSchema = z.object({ code: z.string().min(4).max(12), expiresAt: z.number().int(), botUsername: z.string().nullable(), telegramBotUsername: z.string().nullable().optional() });
/** Kinds a player can switch off for themselves (security, admin and broadcast messages always arrive). */
export const MUTABLE_NOTIFY_KINDS = ['match_result', 'daily_ready', 'friend_request', 'table_invite', 'chat_message'] as const;
export type MutableNotifyKind = (typeof MUTABLE_NOTIFY_KINDS)[number];
/** `GET/PUT /bale/prefs`: the kinds this player has switched off. */
export const balePrefsSchema = z.object({ muted: z.array(z.enum(MUTABLE_NOTIFY_KINDS)) });
export type BalePrefs = z.infer<typeof balePrefsSchema>;
/** `GET /me/group-stats`: what this player earned playing the bot in Bale/Telegram groups (D249). Only groups where their messenger id mapped to this account count. */
export const groupStatsSchema = z.object({
  /** All-time points, groups found, wrong answers and groups played in. */
  points: z.number().int(),
  groups: z.number().int(),
  wrong: z.number().int(),
  groupCount: z.number().int(),
  weekPoints: z.number().int(),
  /** Paid to the account today and the daily ceilings. */
  today: z.object({ coins: z.number().int(), xp: z.number().int(), coinsCap: z.number().int(), xpCap: z.number().int() }),
  /** Everything group play ever paid to the account. */
  totalCoins: z.number().int(),
  totalXp: z.number().int(),
});
export type GroupStats = z.infer<typeof groupStatsSchema>;
export type BaleLinkStatus = z.infer<typeof baleLinkStatusSchema>;
export type BaleLinkCode = z.infer<typeof baleLinkCodeSchema>;

/** `GET /inbox`: the player's in-app messages (newest first) and how many are unread. */
export const inboxSchema = z.object({
  unread: z.number().int().nonnegative(),
  items: z.array(z.object({ id: z.string(), title: z.string(), body: z.string(), createdAt: z.number().int(), read: z.boolean(), /** The player the message is about (a friend's birthday): a tap opens their profile. */ playerId: z.string().nullable().optional() })),
});
export type Inbox = z.infer<typeof inboxSchema>;

/** `GET /me/ledger`: the player's own coin movements (newest first), financial rows only. `next` is the cursor for the following page. */
export const ledgerPageSchema = z.object({
  balance: z.number().int(),
  items: z.array(z.object({ id: z.string(), delta: z.number().int(), reason: z.string(), createdAt: z.number().int() })),
  next: z.string().nullable(),
});
export type LedgerPage = z.infer<typeof ledgerPageSchema>;

/** `GET /me/pending-notices?after=<ms>`: what is new for the player since the device last looked (the Android background check polls this; no push service involved). `id` is stable, so a device never shows the same item twice. */
export const pendingNoticesSchema = z.object({
  now: z.number().int(),
  items: z.array(z.object({ id: z.string().max(80), kind: z.enum(['inbox', 'friend_request']), title: z.string().max(200), body: z.string().max(500), at: z.number().int() })).max(20),
});
export type PendingNotices = z.infer<typeof pendingNoticesSchema>;
