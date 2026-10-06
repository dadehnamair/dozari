import { z } from 'zod';
import { CHAT_MODES, FRIEND_APPROVALS, GUARDIAN_REMINDER_CHOICES } from '../config/ageTracks.js';
import type { ChatMode, FriendApproval } from '../config/ageTracks.js';

/** What a guardian chose for one child (docs/logic/age-tracks.md §Guardian panel). Every switch only narrows the open defaults. */
export interface GuardianSettings {
  chatMode: ChatMode;
  friendApproval: FriendApproval;
  duelsEnabled: boolean;
  /** Quiet hours as minutes from midnight; both null = none. The window may cross midnight (22:00–07:00). */
  quietFrom: number | null;
  quietTo: number | null;
  /** Soft reminder after this many play minutes in a day; null = off. */
  reminderMinutes: number | null;
}

/** The open defaults: a child with no row has full friends-and-text chat, auto friends, duels on, no quiet hours, no reminder. */
export const DEFAULT_GUARDIAN_SETTINGS: GuardianSettings = { chatMode: 'friends_text', friendApproval: 'auto', duelsEnabled: true, quietFrom: null, quietTo: null, reminderMinutes: null };

const minuteOfDay = z.number().int().min(0).max(1439);

export const guardianSettingsSchema = z
  .object({
    chatMode: z.enum(CHAT_MODES),
    friendApproval: z.enum(FRIEND_APPROVALS),
    duelsEnabled: z.boolean(),
    quietFrom: minuteOfDay.nullable(),
    quietTo: minuteOfDay.nullable(),
    reminderMinutes: z
      .number()
      .int()
      .refine((n) => (GUARDIAN_REMINDER_CHOICES as readonly number[]).includes(n), 'reminder_choice')
      .nullable(),
  })
  // Quiet hours are a pair: both set or both empty, and a zero-length window is meaningless.
  .refine((s) => (s.quietFrom === null) === (s.quietTo === null) && (s.quietFrom === null || s.quietFrom !== s.quietTo), { message: 'quiet_pair', path: ['quietFrom'] });

/** What a child's own app learns (never the guardian's other choices): enough to hide features and to show the soft rest card. */
export const childLimitsSchema = z.object({
  chatMode: z.enum(CHAT_MODES),
  friendApproval: z.enum(FRIEND_APPROVALS),
  duelsEnabled: z.boolean(),
  quietFrom: minuteOfDay.nullable(),
  quietTo: minuteOfDay.nullable(),
  reminderMinutes: z.number().int().nullable(),
  /** Minutes the child has been in the app today (Tehran day), counted by the app's heartbeat; the reminder card compares it with `reminderMinutes`. */
  playedToday: z.number().int().min(0).default(0),
});
export type ChildLimits = z.infer<typeof childLimitsSchema>;

/** Is `minute` (minutes from midnight, local time) inside the quiet window? Handles a window that crosses midnight. */
export function inQuietHours(s: Pick<GuardianSettings, 'quietFrom' | 'quietTo'>, minute: number): boolean {
  if (s.quietFrom === null || s.quietTo === null) return false;
  return s.quietFrom < s.quietTo ? minute >= s.quietFrom && minute < s.quietTo : minute >= s.quietFrom || minute < s.quietTo;
}
