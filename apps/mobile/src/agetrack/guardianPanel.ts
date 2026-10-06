import type { GuardianSettings } from '@dozari/shared';

/** Whole hours offered for quiet hours (the guardian picks the start and the end). */
export const QUIET_HOURS = Array.from({ length: 24 }, (_, h) => h);

export const hourToMinutes = (hour: number): number => hour * 60;
export const minutesToHour = (minutes: number): number => Math.floor(minutes / 60);

/** Sets quiet hours, or clears both when `from` is null. A zero-length window (same hour twice) is turned into «none», as the server would refuse it. */
export function withQuietHours(s: GuardianSettings, from: number | null, to: number | null): GuardianSettings {
  if (from === null || to === null || from === to) return { ...s, quietFrom: null, quietTo: null };
  return { ...s, quietFrom: hourToMinutes(from), quietTo: hourToMinutes(to) };
}

/** Does a change need a save? (The panel saves each switch at once; this avoids a call when nothing changed.) */
export const sameSettings = (a: GuardianSettings, b: GuardianSettings): boolean =>
  a.chatMode === b.chatMode && a.friendApproval === b.friendApproval && a.duelsEnabled === b.duelsEnabled && a.quietFrom === b.quietFrom && a.quietTo === b.quietTo && a.reminderMinutes === b.reminderMinutes;
