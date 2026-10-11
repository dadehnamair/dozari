/** Pure 5-field cron (`minute hour day-of-month month day-of-week`), read in a fixed UTC offset. No I/O, no clock. */
export interface CronSpec {
  minutes: ReadonlySet<number>;
  hours: ReadonlySet<number>;
  days: ReadonlySet<number>;
  months: ReadonlySet<number>;
  /** 0 = Sunday … 6 = Saturday (7 is read as Sunday). */
  weekdays: ReadonlySet<number>;
  /** True when the field was `*`, which decides how day-of-month and weekday combine (standard cron: both restricted → either). */
  anyDay: boolean;
  anyWeekday: boolean;
}

const RANGES = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
] as const;

function parseField(text: string, min: number, max: number): Set<number> | null {
  const out = new Set<number>();
  for (const part of text.split(',')) {
    const m = /^(\*|\d{1,2}(?:-\d{1,2})?)(?:\/(\d{1,2}))?$/.exec(part);
    if (!m) return null;
    const step = m[2] === undefined ? 1 : Number(m[2]);
    if (step < 1) return null;
    let lo = min;
    let hi = max;
    if (m[1] !== '*') {
      const [a, b] = m[1]!.split('-');
      lo = Number(a);
      hi = b === undefined ? (m[2] === undefined ? lo : max) : Number(b);
    }
    if (lo < min || hi > max || lo > hi) return null;
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out.size > 0 ? out : null;
}

/** Parses an expression; `null` when it is not valid. */
export function parseCron(expr: string): CronSpec | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const sets = parts.map((p, i) => parseField(p, RANGES[i]![0], RANGES[i]![1]));
  if (sets.some((s) => s === null)) return null;
  const [minutes, hours, days, months, weekdays] = sets as Set<number>[];
  if (weekdays!.has(7)) {
    weekdays!.delete(7);
    weekdays!.add(0);
  }
  return { minutes: minutes!, hours: hours!, days: days!, months: months!, weekdays: weekdays!, anyDay: parts[2] === '*', anyWeekday: parts[4] === '*' };
}

const MINUTE = 60_000;
const DAY = 86_400_000;

/**
 * The first firing time strictly after `afterMs` (epoch ms), or `null` when none exists within about 4 years.
 * `offsetMinutes` is the zone's offset from UTC (Tehran: 210).
 */
export function nextCronRun(spec: CronSpec, afterMs: number, offsetMinutes: number): number | null {
  const shift = offsetMinutes * MINUTE;
  const start = Math.floor((afterMs + shift) / MINUTE) * MINUTE + MINUTE;
  const dayStart = Math.floor(start / DAY) * DAY;
  const hours = [...spec.hours].sort((a, b) => a - b);
  const minutes = [...spec.minutes].sort((a, b) => a - b);
  for (let d = 0; d < 366 * 4; d++) {
    const date = new Date(dayStart + d * DAY);
    if (!spec.months.has(date.getUTCMonth() + 1)) continue;
    const dom = spec.days.has(date.getUTCDate());
    const dow = spec.weekdays.has(date.getUTCDay());
    const dayOk = spec.anyDay && spec.anyWeekday ? true : spec.anyDay ? dow : spec.anyWeekday ? dom : dom || dow;
    if (!dayOk) continue;
    for (const h of hours) for (const m of minutes) {
      const t = dayStart + d * DAY + h * 3_600_000 + m * MINUTE;
      if (t >= start) return t - shift;
    }
  }
  return null;
}

/** Smallest gap, in minutes, between the next `samples` firings after `afterMs`; `null` when fewer than two exist. */
export function minCronGapMinutes(spec: CronSpec, afterMs: number, offsetMinutes: number, samples = 60): number | null {
  let prev = nextCronRun(spec, afterMs, offsetMinutes);
  let gap: number | null = null;
  for (let i = 0; i < samples && prev !== null; i++) {
    const next = nextCronRun(spec, prev, offsetMinutes);
    if (next === null) break;
    const g = (next - prev) / MINUTE;
    gap = gap === null ? g : Math.min(gap, g);
    prev = next;
  }
  return gap;
}
