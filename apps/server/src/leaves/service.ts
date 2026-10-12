import { DEFAULT_LEAVE_RULES, leaveStatus } from '@dozari/shared';
import type { LeaveRules, LeaveStatus } from '@dozari/shared';
import { and, desc, eq, gt, matchLeaves } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';

export type LeaveKind = 'manual' | 'absent';

/** I/O boundary of the leave log. */
export interface LeaveStore {
  add(userId: string, matchId: string | null, kind: LeaveKind, at: number): Promise<void>;
  /** Times (ms) of the user's leaves after `sinceMs`. */
  timesSince(userId: string, sinceMs: number): Promise<number[]>;
}

export function createDbLeaveStore(db: Db): LeaveStore {
  return {
    async add(userId, matchId, kind, at) {
      await db.insert(matchLeaves).values({ id: uuidv7(), userId, matchId, kind, leftAt: new Date(at) });
    },
    async timesSince(userId, sinceMs) {
      const rows = await db.select({ at: matchLeaves.leftAt }).from(matchLeaves).where(and(eq(matchLeaves.userId, userId), gt(matchLeaves.leftAt, new Date(sinceMs)))).orderBy(desc(matchLeaves.leftAt)).limit(500);
      return rows.map((r) => r.at.getTime());
    },
  };
}

export function createMemoryLeaveStore(): LeaveStore & { rows: { userId: string; matchId: string | null; kind: LeaveKind; at: number }[] } {
  const rows: { userId: string; matchId: string | null; kind: LeaveKind; at: number }[] = [];
  return {
    rows,
    async add(userId, matchId, kind, at) {
      rows.push({ userId, matchId, kind, at });
    },
    async timesSince(userId, sinceMs) {
      return rows.filter((r) => r.userId === userId && r.at > sinceMs).map((r) => r.at);
    },
  };
}

/**
 * The leave penalty (docs/logic/leave-penalty.md): every leave of a running duel/table is logged; enough of them in a Tehran day close
 * duels and tables until the day ends, and enough in a month put the «ترک‌کننده» badge on the profile until they age out.
 */
export class LeaveService {
  constructor(
    private readonly store: LeaveStore,
    private readonly rules: () => Promise<LeaveRules> = async () => DEFAULT_LEAVE_RULES,
    private readonly now: () => number = Date.now,
  ) {}

  async record(userId: string, matchId: string | null, kind: LeaveKind): Promise<LeaveStatus> {
    await this.store.add(userId, matchId, kind, this.now());
    return this.status(userId);
  }

  async status(userId: string): Promise<LeaveStatus> {
    const rules = await this.rules();
    const now = this.now();
    // The widest look-back is the badge window (a day is always inside it).
    const times = await this.store.timesSince(userId, now - Math.max(rules.badgeWindowDays, 1) * 24 * 3_600_000);
    return leaveStatus(times, now, rules);
  }

  /** True while the player is barred from duels and tables. */
  async isBanned(userId: string): Promise<boolean> {
    return (await this.status(userId)).bannedUntil !== null;
  }
}

/** The admin-edited leave numbers (`leave.*` settings). */
export async function leaveRulesFromSettings(settings: { num(key: string): Promise<number> }): Promise<LeaveRules> {
  const [dayBanCount, badgeCount, badgeWindowDays] = await Promise.all([settings.num('leave.day_ban_count'), settings.num('leave.badge_count'), settings.num('leave.badge_days')]);
  return { dayBanCount, badgeCount, badgeWindowDays };
}
