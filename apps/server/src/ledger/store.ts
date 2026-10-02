import { and, coinLedger, desc, eq, lt, or, userBalances } from '@dozari/db';
import type { Db } from '@dozari/db';

export interface LedgerRow {
  id: string;
  delta: number;
  reason: string;
  createdAt: number;
}

/** Read side of the coin ledger: a player's own rows, newest first, keyset-paged by (createdAt, id). */
export interface LedgerReader {
  balance(userId: string): Promise<number>;
  page(userId: string, limit: number, before: { createdAt: number; id: string } | null): Promise<LedgerRow[]>;
}

export function createDbLedgerReader(db: Db): LedgerReader {
  return {
    async balance(userId) {
      const [r] = await db.select({ balance: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId));
      return r?.balance ?? 0;
    },
    async page(userId, limit, before) {
      const when = before ? new Date(before.createdAt) : null;
      const rows = await db
        .select({ id: coinLedger.id, delta: coinLedger.delta, reason: coinLedger.reason, createdAt: coinLedger.createdAt })
        .from(coinLedger)
        .where(and(eq(coinLedger.userId, userId), when && before ? or(lt(coinLedger.createdAt, when), and(eq(coinLedger.createdAt, when), lt(coinLedger.id, before.id))) : undefined))
        .orderBy(desc(coinLedger.createdAt), desc(coinLedger.id))
        .limit(limit);
      return rows.map((r) => ({ id: r.id, delta: r.delta, reason: r.reason, createdAt: r.createdAt.getTime() }));
    },
  };
}

export function createMemoryLedgerReader(rows: Record<string, LedgerRow[]> = {}, balances: Record<string, number> = {}): LedgerReader {
  return {
    async balance(userId) {
      return balances[userId] ?? 0;
    },
    async page(userId, limit, before) {
      const all = [...(rows[userId] ?? [])].sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1));
      const rest = before ? all.filter((r) => r.createdAt < before.createdAt || (r.createdAt === before.createdAt && r.id < before.id)) : all;
      return rest.slice(0, limit);
    },
  };
}
