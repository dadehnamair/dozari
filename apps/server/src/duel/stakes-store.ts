import { and, coinLedger, dailyPlayCounts, eq, gte, sql, userBalances } from '@dozari/db';
import type { Db } from '@dozari/db';
import { applyLedgerEntry } from '../economy/ledger.js';

export type StakeReason = 'match_entry' | 'match_payout' | 'match_refund' | 'match_consolation' | 'broke_rescue' | 'price_guess_wager' | 'price_guess_payout';

/** I/O boundary of duel stakes. Every coin movement is one idempotent ledger row. */
export interface StakeStore {
  balance(userId: string): Promise<number>;
  /** Moves `delta` coins; false when a debit would take the balance below zero. A repeated key is a no-op that counts as done. */
  apply(userId: string, delta: number, reason: StakeReason, matchId: string | null, key: string): Promise<boolean>;
  /** Free matches already used on this Tehran day. */
  freeUsed(userId: string, dateKey: string): Promise<number>;
  bumpFree(userId: string, dateKey: string): Promise<void>;
  /** Sum of coins of this reason credited since `sinceMs` (consolation cap) or the number of such rows (rescue). */
  creditedSince(userId: string, reason: StakeReason, sinceMs: number): Promise<{ total: number; rows: number }>;
}

export function createDbStakeStore(db: Db): StakeStore {
  return {
    async balance(userId) {
      const [r] = await db.select({ b: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId));
      return r?.b ?? 0;
    },
    apply: (userId, delta, reason, matchId, key) =>
      db.transaction(async (tx) => {
        const out = await applyLedgerEntry(tx, { userId, delta, reason, refType: matchId ? 'match' : undefined, refId: matchId ?? undefined, idempotencyKey: key });
        return out.applied || out.reason === 'duplicate';
      }),
    async freeUsed(userId, dateKey) {
      const [r] = await db.select({ c: dailyPlayCounts.count }).from(dailyPlayCounts).where(and(eq(dailyPlayCounts.userId, userId), eq(dailyPlayCounts.dateKey, dateKey), eq(dailyPlayCounts.mode, 'duel_free')));
      return r?.c ?? 0;
    },
    async bumpFree(userId, dateKey) {
      await db.insert(dailyPlayCounts).values({ userId, dateKey, mode: 'duel_free', count: 1 }).onDuplicateKeyUpdate({ set: { count: sql`${dailyPlayCounts.count} + 1` } });
    },
    async creditedSince(userId, reason, sinceMs) {
      const [r] = await db
        .select({ total: sql<number>`COALESCE(SUM(${coinLedger.delta}), 0)`, rows: sql<number>`COUNT(*)` })
        .from(coinLedger)
        .where(and(eq(coinLedger.userId, userId), eq(coinLedger.reason, reason), gte(coinLedger.createdAt, new Date(sinceMs))));
      return { total: Number(r?.total ?? 0), rows: Number(r?.rows ?? 0) };
    },
  };
}

/** In-memory twin for tests. */
export function createMemoryStakeStore(): StakeStore & { balances: Map<string, number>; log: { userId: string; delta: number; reason: StakeReason; key: string; at: number }[]; clock: { ms: number } } {
  const balances = new Map<string, number>();
  const keys = new Set<string>();
  const free = new Map<string, number>();
  const log: { userId: string; delta: number; reason: StakeReason; key: string; at: number }[] = [];
  const clock = { ms: Date.UTC(2026, 9, 2, 12) };
  return {
    balances,
    log,
    clock,
    async balance(u) {
      return balances.get(u) ?? 0;
    },
    async apply(u, delta, reason, _matchId, key) {
      if (keys.has(key)) return true;
      const next = (balances.get(u) ?? 0) + delta;
      if (next < 0) return false;
      keys.add(key);
      balances.set(u, next);
      log.push({ userId: u, delta, reason, key, at: clock.ms });
      return true;
    },
    async freeUsed(u, d) {
      return free.get(`${u}|${d}`) ?? 0;
    },
    async bumpFree(u, d) {
      free.set(`${u}|${d}`, (free.get(`${u}|${d}`) ?? 0) + 1);
    },
    async creditedSince(u, reason, since) {
      const rows = log.filter((l) => l.userId === u && l.reason === reason && l.at >= since);
      return { total: rows.reduce((a, l) => a + l.delta, 0), rows: rows.length };
    },
  };
}
