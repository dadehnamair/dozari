import { z } from 'zod';

export const BADGE_KINDS = ['badge', 'medal'] as const;
/** What holding the badge allows: `share_contact` = may send phone numbers, links and IDs in chat; `moderator` = «آجان دوزاری»: warn and mute for a short time. */
export const BADGE_PERKS = ['none', 'share_contact', 'moderator'] as const;
export const BADGE_RULE_METRICS = ['none', 'games', 'wins', 'level'] as const;

export const badgeSchema = z.object({
  id: z.string().uuid(),
  titleFa: z.string(),
  descriptionFa: z.string(),
  kind: z.enum(BADGE_KINDS),
  iconKey: z.string().nullable(),
  perk: z.enum(BADGE_PERKS),
});
export type Badge = z.infer<typeof badgeSchema>;

export const lockedBadgeSchema = badgeSchema.extend({
  /** Automatic unlock rule, e.g. `wins` ≥ 20; `none` means only an admin grants it. */
  metric: z.enum(BADGE_RULE_METRICS),
  min: z.number().int().nonnegative(),
  /** Current value of the metric, so the app can show progress. */
  have: z.number().int().nonnegative(),
});

export const NOTICE_KINDS = ['warning', 'commendation'] as const;
export const noticeSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(NOTICE_KINDS),
  text: z.string(),
  by: z.enum(['admin', 'agent']),
  createdAt: z.number().int(),
  read: z.boolean(),
});
export type Notice = z.infer<typeof noticeSchema>;

export const SKILL_TIER_VALUES = ['novice', 'beginner', 'pro'] as const;

/** `GET /me/badges`: earned and still locked badges, which one is shown, perks, notices. */
export const myBadgesSchema = z.object({
  earned: z.array(badgeSchema),
  locked: z.array(lockedBadgeSchema),
  equippedId: z.string().uuid().nullable(),
  perks: z.object({ shareContact: z.boolean(), moderator: z.boolean() }),
  notices: z.array(noticeSchema),
  muted: z.object({ until: z.number().int(), reason: z.string() }).nullable(),
  skill: z.enum(SKILL_TIER_VALUES),
});
export type MyBadges = z.infer<typeof myBadgesSchema>;

/** What anybody sees on a profile: the shown badge, medals, skill tier. Warnings are private. */
export const publicBadgesSchema = z.object({
  badge: badgeSchema.nullable(),
  medals: z.array(badgeSchema),
  skill: z.enum(SKILL_TIER_VALUES),
});
export type PublicBadges = z.infer<typeof publicBadgesSchema>;

export const MOD_ERRORS = ['NOT_MODERATOR', 'SELF', 'PROTECTED', 'NOT_FOUND', 'LIMIT', 'DURATION', 'TEXT'] as const;
export type ModError = (typeof MOD_ERRORS)[number];
