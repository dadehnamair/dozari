import { describe, expect, it } from 'vitest';
import { groupPoints, groupWeekKey, rankGroupScores } from '../score.js';

describe('group scores', () => {
  it('pays more for harder groups', () => {
    expect([0, 1, 2, 3].map((l) => groupPoints(l as 0 | 1 | 2 | 3))).toEqual([10, 15, 20, 25]);
  });

  it('names the week by its Saturday', () => {
    expect(groupWeekKey('2026-10-17')).toBe('2026-10-17'); // a Saturday
    expect(groupWeekKey('2026-10-18')).toBe('2026-10-17'); // Sunday
    expect(groupWeekKey('2026-10-23')).toBe('2026-10-17'); // Friday
    expect(groupWeekKey('2026-10-24')).toBe('2026-10-24');
    expect(groupWeekKey('2026-01-02')).toBe('2025-12-27'); // across the year end
  });

  it('ranks by points, then groups, then fewer wrong submits', () => {
    const r = (userRef: string, points: number, groups: number, wrong: number) => ({ userRef, name: userRef, points, groups, wrong });
    expect(rankGroupScores([r('a', 10, 1, 0), r('b', 30, 2, 5), r('c', 30, 2, 1), r('d', 30, 3, 9)]).map((x) => x.userRef)).toEqual(['d', 'c', 'b', 'a']);
  });
});
