import { describe, expect, it } from 'vitest';
import { restCardFor, snoozeUntil } from '../restCard';

const night = { quietFrom: 22 * 60, quietTo: 7 * 60, reminderMinutes: 30 };
const base = { minuteOfDay: 12 * 60, sessionMinutes: 5, now: 1_000_000, snoozedUntil: 0 };

describe('restCardFor', () => {
  it('shows nothing without limits or during the day with a short session', () => {
    expect(restCardFor(null, base)).toBeNull();
    expect(restCardFor(night, base)).toBeNull();
  });

  it('shows the quiet-hours card inside the window, also past midnight', () => {
    expect(restCardFor(night, { ...base, minuteOfDay: 23 * 60 })).toBe('quiet');
    expect(restCardFor(night, { ...base, minuteOfDay: 3 * 60 })).toBe('quiet');
  });

  it('shows the reminder after the chosen minutes, and quiet hours win', () => {
    expect(restCardFor(night, { ...base, sessionMinutes: 30 })).toBe('reminder');
    expect(restCardFor(night, { ...base, sessionMinutes: 99, minuteOfDay: 23 * 60 })).toBe('quiet');
    expect(restCardFor({ ...night, reminderMinutes: null }, { ...base, sessionMinutes: 99 })).toBeNull();
  });

  it('a dismissed card stays away for ten minutes and then comes back (never a lock)', () => {
    const until = snoozeUntil(base.now);
    expect(until - base.now).toBe(10 * 60_000);
    const quiet = { ...base, minuteOfDay: 23 * 60 };
    expect(restCardFor(night, { ...quiet, snoozedUntil: until })).toBeNull();
    expect(restCardFor(night, { ...quiet, snoozedUntil: until, now: until })).toBe('quiet');
  });
});
