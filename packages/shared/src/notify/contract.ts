import { z } from 'zod';

/** `GET /bale/link`: is the Bale bot set up, and is this player linked. */
export const baleLinkStatusSchema = z.object({ configured: z.boolean(), linked: z.boolean(), botUsername: z.string().nullable() });
/** `POST /bale/link-code`: the one-time code the player sends to the bot. */
export const baleLinkCodeSchema = z.object({ code: z.string().min(4).max(12), expiresAt: z.number().int(), botUsername: z.string().nullable() });
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
