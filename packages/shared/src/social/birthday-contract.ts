import { z } from 'zod';

/** A Solar Hijri birth date (D160); validity (real day, minimum age) is checked by the server. */
export const birthDateSchema = z.object({ year: z.number().int(), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) });
export type BirthDate = z.infer<typeof birthDateSchema>;

/** `PUT /me/birthday`: `birth: null` clears the date. */
export const birthdayPutSchema = z.object({ birth: birthDateSchema.nullable(), showAge: z.boolean(), notifyFriends: z.boolean() });
export type BirthdayPut = z.infer<typeof birthdayPutSchema>;

/** The gift of the birthday week: amounts are admin settings. */
export const birthdayGiftSchema = z.object({
  coins: z.number().int().nonnegative(),
  gems: z.number().int().nonnegative(),
  spins: z.number().int().nonnegative(),
  claimed: z.boolean(),
  /** In the week, not yet taken this year, and worth something. */
  claimable: z.boolean(),
});

/** `GET /me/birthday`: the caller's own birth settings and where today stands against the birthday. */
export const myBirthdaySchema = z.object({
  birth: birthDateSchema.nullable(),
  showAge: z.boolean(),
  notifyFriends: z.boolean(),
  age: z.number().int().nonnegative().nullable(),
  minAge: z.number().int().positive(),
  inWeek: z.boolean(),
  isToday: z.boolean(),
  gift: birthdayGiftSchema,
});
export type MyBirthday = z.infer<typeof myBirthdaySchema>;

/** `POST /me/birthday/claim` answer. */
export const birthdayClaimSchema = z.object({ ok: z.literal(true), coins: z.number().int().nonnegative(), gems: z.number().int().nonnegative(), spins: z.number().int().nonnegative(), balance: z.number().int().nonnegative() });
export type BirthdayClaim = z.infer<typeof birthdayClaimSchema>;
