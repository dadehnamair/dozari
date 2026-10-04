import { dailyDateKey } from '@dozari/shared';
import { and, dailyPlayCounts, eq, sql } from '@dozari/db';
import type { Db } from '@dozari/db';

export type PlayMode = 'solo' | 'duel';

/** I/O boundary of the per-day game counters. */
export interface PlayCountStore {
  count(userId: string, dateKey: string, mode: PlayMode): Promise<number>;
  bump(userId: string, dateKey: string, mode: PlayMode): Promise<void>;
}

export function createDbPlayCountStore(db: Db): PlayCountStore {
  return {
    async count(userId, dateKey, mode) {
      const [r] = await db.select({ c: dailyPlayCounts.count }).from(dailyPlayCounts).where(and(eq(dailyPlayCounts.userId, userId), eq(dailyPlayCounts.dateKey, dateKey), eq(dailyPlayCounts.mode, mode)));
      return r?.c ?? 0;
    },
    async bump(userId, dateKey, mode) {
      await db.insert(dailyPlayCounts).values({ userId, dateKey, mode, count: 1 }).onDuplicateKeyUpdate({ set: { count: sql`${dailyPlayCounts.count} + 1` } });
    },
  };
}

export function createMemoryPlayCountStore(): PlayCountStore {
  const m = new Map<string, number>();
  const key = (u: string, d: string, mode: string) => `${u}|${d}|${mode}`;
  return {
    async count(u, d, mode) {
      return m.get(key(u, d, mode)) ?? 0;
    },
    async bump(u, d, mode) {
      m.set(key(u, d, mode), (m.get(key(u, d, mode)) ?? 0) + 1);
    },
  };
}

export type CapCheck = { ok: true; left: number | null } | { ok: false; cap: number };

/** Daily game caps per mode. A cap of 0 means unlimited; the number is an admin setting (`limit.<mode>_per_day`). */
export class PlayLimiter {
  constructor(
    private readonly store: PlayCountStore,
    private readonly capOf: (mode: PlayMode) => Promise<number>,
    private readonly now: () => number = Date.now,
  ) {}

  async check(userId: string, mode: PlayMode): Promise<CapCheck> {
    const cap = await this.capOf(mode);
    if (cap <= 0) return { ok: true, left: null };
    const used = await this.store.count(userId, dailyDateKey(this.now()), mode);
    return used >= cap ? { ok: false, cap } : { ok: true, left: cap - used };
  }

  /** A game of this mode really started. */
  async record(userId: string, mode: PlayMode): Promise<void> {
    await this.store.bump(userId, dailyDateKey(this.now()), mode);
  }
}
