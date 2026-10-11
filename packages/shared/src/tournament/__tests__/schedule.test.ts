import { describe, expect, it } from 'vitest';
import { forfeitOutcome, matchDeadline, roundOpensAt, turnState } from '../schedule.js';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

describe('tournament schedule', () => {
  it('opens one round per gap, starting with the tournament', () => {
    expect(roundOpensAt(1000, 1440, 1)).toBe(1000);
    expect(roundOpensAt(1000, 1440, 2)).toBe(1000 + DAY);
    expect(roundOpensAt(1000, 1440, 4)).toBe(1000 + 3 * DAY);
    expect(roundOpensAt(1000, 0, 3)).toBe(1000);
  });
  it('closes the window after the grace minutes', () => {
    expect(matchDeadline(5000, 15)).toBe(5000 + 15 * MIN);
  });
  it('tells where a turn stands', () => {
    const base = { opensAt: 100, playing: false, checkedIn: false };
    expect(turnState({ ...base, now: 50 })).toBe('upcoming');
    expect(turnState({ ...base, now: 100 })).toBe('open');
    expect(turnState({ ...base, now: 120, checkedIn: true })).toBe('checked_in');
    expect(turnState({ ...base, now: 120, playing: true, checkedIn: true })).toBe('playing');
    expect(turnState({ ...base, now: 50, checkedIn: true })).toBe('upcoming');
  });
  it('lets the one who showed up win, and the better seed go on when nobody did', () => {
    expect(forfeitOutcome(true, true)).toBe('play');
    expect(forfeitOutcome(true, false)).toBe('a');
    expect(forfeitOutcome(false, true)).toBe('b');
    expect(forfeitOutcome(false, false)).toBe('seed');
  });
});
