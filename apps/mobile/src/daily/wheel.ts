import { coinsForDay } from '@dozari/shared';

export const WHEEL_SLICES = 8;

/** Coins on the eight slices: slice 0 is today's reward, then the next seven days (the wheel always lands on slice 0). */
export function wheelAmounts(steps: readonly number[], day: number): number[] {
  return Array.from({ length: WHEEL_SLICES }, (_, i) => coinsForDay([...steps], day + i));
}

/** Degrees the wheel turns for a spin: whole turns plus nothing, so slice 0 stops under the pointer at the top. */
export function spinTarget(turns = 5): number {
  return turns * 360;
}

/** Seven days for the strip: starts two days before today (not before day 1); done / today / ahead. */
export function streakStrip(steps: readonly number[], day: number): { day: number; coins: number; state: 'done' | 'today' | 'ahead' }[] {
  const first = Math.max(1, day - 2);
  return Array.from({ length: 7 }, (_, i) => {
    const d = first + i;
    return { day: d, coins: coinsForDay([...steps], d), state: d < day ? ('done' as const) : d === day ? ('today' as const) : ('ahead' as const) };
  });
}
