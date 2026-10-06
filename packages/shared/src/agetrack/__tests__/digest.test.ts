import { describe, expect, it } from 'vitest';
import { weekSummary } from '../digest.js';

const DAY = 86_400_000;
const NOW = 100 * DAY + 5_000;

describe('weekSummary', () => {
  it('counts games, wins and different days inside the window only', () => {
    const games = [
      { outcome: 'win' as const, at: NOW - 100 }, // today
      { outcome: 'loss' as const, at: NOW - 200 }, // today again
      { outcome: 'win' as const, at: NOW - 2 * DAY },
      { outcome: 'win' as const, at: NOW - 8 * DAY }, // too old
      { outcome: null, at: NOW - 3 * DAY },
    ];
    expect(weekSummary(games, NOW)).toEqual({ games: 4, wins: 2, daysPlayed: 3 });
  });

  it('is zero for no games', () => {
    expect(weekSummary([], NOW)).toEqual({ games: 0, wins: 0, daysPlayed: 0 });
  });
});
