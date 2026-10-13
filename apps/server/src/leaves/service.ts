import { DEFAULT_LEAVE_RULES, leaveStatus, leavesLeftToday } from '@dozari/shared';
import type { LeaveRules, LeaveStatus } from '@dozari/shared';
import { and, desc, eq, gt, matchLeaves, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';

export type LeaveKind = 'manual' | 'absent';

/** I/O boundary of the leave log. */
export interface LeaveStore {
  add(userId: string, matchId: string | null, kind: LeaveKind, at: number): Promise<void>;
  /** Times (ms) of the user's leaves after `sinceMs`. */
  timesSince(userId: string, sinceMs: number): Promise<number[]>;
  /** The newest leaves of everybody, newest first (admin log). */
  recent(limit: number): Promise<LeaveLogRow[]>;
}

export interface LeaveLogRow {
  userId: string;
  nickname: string;
  matchId: string | null;
  kind: LeaveKind;
  at: number;
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
    async recent(limit) {
      const rows = await db
        .select({ userId: matchLeaves.userId, nickname: users.nickname, matchId: matchLeaves.matchId, kind: matchLeaves.kind, at: matchLeaves.leftAt })
        .from(matchLeaves)
        .innerJoin(users, eq(users.id, matchLeaves.userId))
        .orderBy(desc(matchLeaves.leftAt))
        .limit(limit);
      return rows.map((r) => ({ ...r, at: r.at.getTime() }));
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
    async recent(limit) {
      return [...rows].sort((a, b) => b.at - a.at).slice(0, limit).map((r) => ({ ...r, nickname: r.userId }));
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

  /** What the player sees before leaving: leaves so far today, how many remain before the day ban (null = no ban rule), and any ban in force. */
  async warning(userId: string): Promise<{ today: number; left: number | null; bannedUntil: number | null }> {
    const rules = await this.rules();
    const st = await this.status(userId);
    return { today: st.today, left: rules.dayBanCount > 0 ? leavesLeftToday(st, rules) : null, bannedUntil: st.bannedUntil };
  }

  /** The admin log: the newest leaves with who left and how, and the rules in force. */
  async log(limit = 200): Promise<{ rows: LeaveLogRow[]; rules: LeaveRules }> {
    return { rows: await this.store.recent(Math.max(1, Math.min(500, limit))), rules: await this.rules() };
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
