import { z } from 'zod';

/** `GET /me/phone`: masked numbers only; the full number never goes back to the app. */
export const phoneStatusSchema = z.object({
  phone: z.string().nullable(),
  pending: z.string().nullable(),
  verified: z.boolean(),
  smsAvailable: z.boolean(),
});
export type PhoneStatus = z.infer<typeof phoneStatusSchema>;
