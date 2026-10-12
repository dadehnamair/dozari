import { LEAVE_BADGE_COUNT, LEAVE_BADGE_WINDOW_DAYS, LEAVE_DAY_BAN_COUNT } from '../config/leave.js';
import { tehranDayStart } from '../calendar/tehran-day.js';

const DAY_MS = 24 * 3_600_000;

export interface LeaveRules {
  dayBanCount: number;
  badgeCount: number;
  badgeWindowDays: number;
}

export const DEFAULT_LEAVE_RULES: LeaveRules = { dayBanCount: LEAVE_DAY_BAN_COUNT, badgeCount: LEAVE_BADGE_COUNT, badgeWindowDays: LEAVE_BADGE_WINDOW_DAYS };

export interface LeaveStatus {
  /** Leaves in the current Tehran day. */
  today: number;
  /** Leaves inside the badge window. */
  inWindow: number;
  /** Closed for duels and tables until this time (ms, the end of the Tehran day), else null. */
  bannedUntil: number | null;
  /** The «ترک‌کننده» badge is on until this time (ms): the moment enough old leaves have aged out. Null = no badge. */
  badgeUntil: number | null;
}

/**
 * Where a player stands, from the times (ms) of their leaves. The day ban holds until the Tehran day ends; the badge holds
 * while `badgeCount` leaves sit inside the window and ends when enough of the oldest ones fall out of it.
 */
export function leaveStatus(leaveTimes: readonly number[], now: number, rules: LeaveRules = DEFAULT_LEAVE_RULES): LeaveStatus {
  const dayStart = tehranDayStart(now);
  const today = leaveTimes.filter((t) => t >= dayStart && t <= now).length;
  const windowMs = rules.badgeWindowDays * DAY_MS;
  const recent = leaveTimes.filter((t) => t > now - windowMs && t <= now).sort((a, b) => a - b);
  let badgeUntil: number | null = null;
  if (rules.badgeCount > 0 && recent.length >= rules.badgeCount) {
    // The badge ends when the count drops below the threshold: the (count - threshold + 1)-th oldest leave has to age out.
    badgeUntil = recent[recent.length - rules.badgeCount]! + windowMs;
  }
  return {
    today,
    inWindow: recent.length,
    bannedUntil: rules.dayBanCount > 0 && today >= rules.dayBanCount ? dayStart + DAY_MS : null,
    badgeUntil,
  };
}

/** Leaves a player may still make today before the ban (shown as a warning before leaving). */
export const leavesLeftToday = (status: LeaveStatus, rules: LeaveRules = DEFAULT_LEAVE_RULES): number => Math.max(0, rules.dayBanCount - status.today);
