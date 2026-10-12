import { describe, expect, it } from 'vitest';
import { tehranDayStart } from '../../calendar/tehran-day.js';
import { DEFAULT_LEAVE_RULES, leaveStatus, leavesLeftToday } from '../policy.js';

const DAY = 24 * 3_600_000;
const noon = tehranDayStart(Date.UTC(2026, 9, 12, 8)) + 12 * 3_600_000; // 12:00 Tehran

describe('leaveStatus', () => {
  it('is clean with no leaves', () => {
    expect(leaveStatus([], noon)).toEqual({ today: 0, inWindow: 0, bannedUntil: null, badgeUntil: null });
  });

  it('bans for the rest of the Tehran day at the fourth leave of the day', () => {
    const at = (h: number) => tehranDayStart(noon) + h * 3_600_000;
    expect(leaveStatus([at(1), at(2), at(3)], noon).bannedUntil).toBeNull();
    const banned = leaveStatus([at(1), at(2), at(3), at(4)], noon);
    expect(banned.today).toBe(4);
    expect(banned.bannedUntil).toBe(tehranDayStart(noon) + DAY);
  });

  it('does not carry the day ban to the next day', () => {
    const yesterday = tehranDayStart(noon) - 3_600_000;
    const s = leaveStatus([yesterday, yesterday - 1, yesterday - 2, yesterday - 3], noon);
    expect(s.today).toBe(0);
    expect(s.bannedUntil).toBeNull();
  });

  it('shows the badge at eight leaves in 30 days and takes it off when the oldest ages out', () => {
    const times = Array.from({ length: 8 }, (_, i) => noon - (i + 1) * 2 * DAY); // 2, 4, ... 16 days ago
    const s = leaveStatus(times, noon);
    expect(s.inWindow).toBe(8);
    // the oldest (16 days ago) leaves the window 14 days from now; then only seven remain
    expect(s.badgeUntil).toBe(noon - 16 * DAY + 30 * DAY);
    expect(leaveStatus(times, s.badgeUntil! + 1).badgeUntil).toBeNull();
  });

  it('leaves outside the window do not count', () => {
    const old = Array.from({ length: 8 }, (_, i) => noon - (31 + i) * DAY);
    expect(leaveStatus(old, noon)).toMatchObject({ inWindow: 0, badgeUntil: null });
  });

  it('counts how many leaves are left before the ban', () => {
    const at = (h: number) => tehranDayStart(noon) + h * 3_600_000;
    expect(leavesLeftToday(leaveStatus([at(1)], noon))).toBe(DEFAULT_LEAVE_RULES.dayBanCount - 1);
  });
});
