import { solarMonthKey } from '@dozari/shared';
import type { SolarMonthKey } from '@dozari/shared';

/** Mascot skin (index into MASCOT_SKINS) that matches the feel of each Solar Hijri month, Farvardin .. Esfand. */
const MONTH_SKIN = [5, 1, 0, 2, 3, 4, 2, 0, 1, 6, 3, 5] as const;

export function monthSkin(month: number): number {
  return MONTH_SKIN[Math.min(11, Math.max(0, Math.trunc(month) - 1))] ?? 0;
}

export const monthKey = (month: number): SolarMonthKey => solarMonthKey(month);
