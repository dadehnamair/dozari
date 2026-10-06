import { and, eq, guardianBlocks, inArray, or, playMinutes, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import { sql } from '@dozari/db';
import { PLAY_HEARTBEAT_MIN_GAP_MS, PLAY_MINUTES_DAY_CAP } from '@dozari/shared';

export interface BlockedRow {
  id: string;
  nickname: string;
  avatarKey: string;
}

/** Players a guardian blocked for a child (docs/logic/age-tracks.md §Guardian panel). */
export interface GuardianBlockStore {
  list(childId: string): Promise<BlockedRow[]>;
  /** False when already blocked. */
  add(childId: string, blockedId: string): Promise<boolean>;
  remove(childId: string, blockedId: string): Promise<boolean>;
  /** Is there a block between these two, in either direction (a child's block hides both from each other)? */
  between(a: string, b: string): Promise<boolean>;
}

export function createDbGuardianBlockStore(db: Db): GuardianBlockStore {
  return {
    async list(childId) {
      const rows = await db.select({ id: users.id, nickname: users.nickname, avatarKey: users.avatarKey }).from(guardianBlocks).innerJoin(users, eq(users.id, guardianBlocks.blockedId)).where(eq(guardianBlocks.childId, childId));
      return rows;
    },
    async add(childId, blockedId) {
      const [res] = await db.insert(guardianBlocks).ignore().values({ childId, blockedId });
      return res.affectedRows > 0;
    },
    async remove(childId, blockedId) {
      const [res] = await db.delete(guardianBlocks).where(and(eq(guardianBlocks.childId, childId), eq(guardianBlocks.blockedId, blockedId)));
      return res.affectedRows > 0;
    },
    async between(a, b) {
      const rows = await db
        .select({ c: guardianBlocks.childId })
        .from(guardianBlocks)
        .where(or(and(eq(guardianBlocks.childId, a), eq(guardianBlocks.blockedId, b)), and(eq(guardianBlocks.childId, b), eq(guardianBlocks.blockedId, a))))
        .limit(1);
      return rows.length > 0;
    },
  };
}

export function createMemoryGuardianBlockStore(names: Record<string, string> = {}): GuardianBlockStore & { pairs: Set<string> } {
  const pairs = new Set<string>();
  return {
    pairs,
    list: async (childId) => [...pairs].filter((p) => p.startsWith(`${childId}|`)).map((p) => p.split('|')[1]!).map((id) => ({ id, nickname: names[id] ?? id, avatarKey: 'avatar-01' })),
    add: async (c, b) => (pairs.has(`${c}|${b}`) ? false : (pairs.add(`${c}|${b}`), true)),
    remove: async (c, b) => pairs.delete(`${c}|${b}`),
    between: async (a, b) => pairs.has(`${a}|${b}`) || pairs.has(`${b}|${a}`),
  };
}

/** Minutes in the app per player and Tehran day, for the guardian's play reminder and the digest. */
export interface PlayTimeStore {
  /** Adds `minutes` to the day, never above `PLAY_MINUTES_DAY_CAP`; returns the day's total. */
  add(userId: string, dayKey: string, minutes: number): Promise<number>;
  /** Total of the listed days. */
  total(userId: string, dayKeys: readonly string[]): Promise<number>;
}

export function createDbPlayTimeStore(db: Db): PlayTimeStore {
  return {
    async add(userId, dayKey, minutes) {
      await db
        .insert(playMinutes)
        .values({ userId, dayKey, minutes: Math.min(minutes, PLAY_MINUTES_DAY_CAP) })
        .onDuplicateKeyUpdate({ set: { minutes: sql`LEAST(${playMinutes.minutes} + ${minutes}, ${PLAY_MINUTES_DAY_CAP})` } });
      return this.total(userId, [dayKey]);
    },
    async total(userId, dayKeys) {
      if (dayKeys.length === 0) return 0;
      const [r] = await db.select({ n: sql<number>`COALESCE(SUM(${playMinutes.minutes}), 0)` }).from(playMinutes).where(and(eq(playMinutes.userId, userId), inArray(playMinutes.dayKey, [...dayKeys])));
      return Number(r?.n ?? 0);
    },
  };
}

export function createMemoryPlayTimeStore(): PlayTimeStore & { rows: Map<string, number> } {
  const rows = new Map<string, number>();
  return {
    rows,
    async add(userId, dayKey, minutes) {
      const next = Math.min((rows.get(`${userId}|${dayKey}`) ?? 0) + minutes, PLAY_MINUTES_DAY_CAP);
      rows.set(`${userId}|${dayKey}`, next);
      return next;
    },
    total: async (userId, dayKeys) => dayKeys.reduce((a, d) => a + (rows.get(`${userId}|${d}`) ?? 0), 0),
  };
}

/**
 * The once-a-minute heartbeat of an open app counts as a minute of play. A heartbeat sooner than `PLAY_HEARTBEAT_MIN_GAP_MS` after the last one is ignored,
 * so a modified client cannot inflate the number and a backgrounded tab does not count (docs/logic/age-tracks.md §Guardian panel).
 */
export class PlayTimeService {
  private readonly last = new Map<string, number>();

  constructor(
    private readonly store: PlayTimeStore,
    private readonly dayKey: (ms: number) => string,
    private readonly now: () => number = Date.now,
  ) {}

  async beat(userId: string): Promise<{ today: number; counted: boolean }> {
    const t = this.now();
    const day = this.dayKey(t);
    const prev = this.last.get(userId);
    if (prev !== undefined && t - prev < PLAY_HEARTBEAT_MIN_GAP_MS) return { today: await this.store.total(userId, [day]), counted: false };
    this.last.set(userId, t);
    return { today: await this.store.add(userId, day, 1), counted: true };
  }

  today(userId: string): Promise<number> {
    return this.store.total(userId, [this.dayKey(this.now())]);
  }

  /** Minutes over the last `days` Tehran days, today included. */
  week(userId: string, days = 7): Promise<number> {
    const keys = Array.from({ length: days }, (_, i) => this.dayKey(this.now() - i * 86_400_000));
    return this.store.total(userId, keys);
  }
}
