import { describe, expect, it } from 'vitest';
import { SEARCH_CELLS, cellLevel, nextScan, searchClock, waitClock } from '../scan';

describe('search scan', () => {
  it('always lands on a different cell inside the grid', () => {
    for (let scan = 0; scan < SEARCH_CELLS; scan++) {
      for (const r of [0, 0.25, 0.5, 0.99]) {
        const next = nextScan(scan, r);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(SEARCH_CELLS);
        expect(next).not.toBe(scan);
      }
    }
  });

  it('keeps levels in 3..30', () => {
    for (let i = 0; i < SEARCH_CELLS; i++) {
      expect(cellLevel(i)).toBeGreaterThanOrEqual(3);
      expect(cellLevel(i)).toBeLessThanOrEqual(30);
    }
  });

  it('counts the search time', () => {
    expect(searchClock(0)).toBe('0:00');
    expect(searchClock(3)).toBe('0:01');
    expect(searchClock(140)).toBe('0:03');
  });
});

describe('waitClock', () => {
  it('shows the real queue wait as m:ss', () => {
    expect(waitClock(0)).toBe('0:00');
    expect(waitClock(7.9)).toBe('0:07');
    expect(waitClock(75)).toBe('1:15');
    expect(waitClock(-3)).toBe('0:00');
  });
});
