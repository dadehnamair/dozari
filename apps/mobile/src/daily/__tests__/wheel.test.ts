import { describe, expect, it } from 'vitest';
import { coinsForDay } from '@dozari/shared';
import { WHEEL_SLICES, spinTarget, streakStrip, wheelAmounts } from '../wheel';

const steps = [10, 20, 30, 40, 50, 60, 100];

describe('daily wheel', () => {
  it('slice 0 is today\'s reward, the rest the next days', () => {
    const a = wheelAmounts(steps, 3);
    expect(a).toHaveLength(WHEEL_SLICES);
    expect(a[0]).toBe(coinsForDay(steps, 3));
    expect(a.slice(0, 3)).toEqual([30, 40, 50]);
  });

  it('a spin is whole turns so slice 0 stops under the pointer', () => {
    expect(spinTarget() % 360).toBe(0);
    expect(spinTarget(3)).toBe(1080);
  });

  it('the strip marks done, today and ahead and never starts before day 1', () => {
    expect(streakStrip(steps, 1).map((d) => d.state)).toEqual(['today', 'ahead', 'ahead', 'ahead', 'ahead', 'ahead', 'ahead']);
    const s = streakStrip(steps, 5);
    expect(s.map((d) => d.day)).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(s.map((d) => d.state)).toEqual(['done', 'done', 'today', 'ahead', 'ahead', 'ahead', 'ahead']);
  });
});
