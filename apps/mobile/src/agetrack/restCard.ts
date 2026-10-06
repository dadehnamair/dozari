import { QUIET_CARD_SNOOZE_MINUTES, inQuietHours } from '@dozari/shared';
import type { ChildLimits } from '@dozari/shared';

export type RestCard = 'quiet' | 'reminder' | null;

/**
 * Which soft «rest» card to show a child (docs/logic/age-tracks.md §Guardian panel). It is only ever a card: `snoozedUntil` (epoch ms) hides it for a while
 * and nothing is locked. Quiet hours win over the play reminder; the reminder fires once this app session has run `reminderMinutes`.
 */
export function restCardFor(limits: Pick<ChildLimits, 'quietFrom' | 'quietTo' | 'reminderMinutes'> | null | undefined, opts: { minuteOfDay: number; sessionMinutes: number; now: number; snoozedUntil: number }): RestCard {
  if (!limits || opts.now < opts.snoozedUntil) return null;
  if (inQuietHours(limits, opts.minuteOfDay)) return 'quiet';
  if (limits.reminderMinutes !== null && opts.sessionMinutes >= limits.reminderMinutes) return 'reminder';
  return null;
}

/** When a card was dismissed at `now`, until when it stays hidden. */
export const snoozeUntil = (now: number): number => now + QUIET_CARD_SNOOZE_MINUTES * 60_000;
