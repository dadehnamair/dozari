import { z } from 'zod';

/** `GET /bale/link`: is the Bale bot set up, and is this player linked. */
export const baleLinkStatusSchema = z.object({ configured: z.boolean(), linked: z.boolean(), botUsername: z.string().nullable() });
/** `POST /bale/link-code`: the one-time code the player sends to the bot. */
export const baleLinkCodeSchema = z.object({ code: z.string().min(4).max(12), expiresAt: z.number().int(), botUsername: z.string().nullable() });
export type BaleLinkStatus = z.infer<typeof baleLinkStatusSchema>;
export type BaleLinkCode = z.infer<typeof baleLinkCodeSchema>;
