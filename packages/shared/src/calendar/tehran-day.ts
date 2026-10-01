const TEHRAN_OFFSET_MS = 3.5 * 3_600_000;
const DAY_MS = 24 * 3_600_000;

/** Start (UTC ms) of the Asia/Tehran calendar day containing `ms`. Iran has no daylight saving since 2022, so the offset is fixed. Daily limits reset here (economy.md). */
export function tehranDayStart(ms: number): number {
  return Math.floor((ms + TEHRAN_OFFSET_MS) / DAY_MS) * DAY_MS - TEHRAN_OFFSET_MS;
}
