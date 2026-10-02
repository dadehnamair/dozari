import { and, asc, eq, isNull, sql, userBalances, wheelSpins } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';
import { applyLedgerEntry } from '../economy/ledger.js';
import type { WheelStore } from './service.js';

export function createDbWheelStore(db: Db): WheelStore {
  const pending = async (userId: string): Promise<number> => {
    const [r] = await db.select({ n: sql<number>`COUNT(*)` }).from(wheelSpins).where(and(eq(wheelSpins.userId, userId), isNull(wheelSpins.spunAt)));
    return Number(r?.n ?? 0);
  };
  const balance = async (userId: string): Promise<number> => {
    const [r] = await db.select({ b: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId));
    return r?.b ?? 0;
  };
  return {
    async grant(userId, matchId) {
      const [res] = await db.insert(wheelSpins).ignore().values({ id: uuidv7(), userId, matchId });
      return res.affectedRows > 0;
    },
    pending,
    balance,
    spin: (userId, roll) =>
      db.transaction(async (tx) => {
        // Lock the oldest waiting spin so two taps cannot both use it.
        const [row] = await tx
          .select({ id: wheelSpins.id, matchId: wheelSpins.matchId })
          .from(wheelSpins)
          .where(and(eq(wheelSpins.userId, userId), isNull(wheelSpins.spunAt)))
          .orderBy(asc(wheelSpins.createdAt), asc(wheelSpins.id))
          .limit(1)
          .for('update');
        if (!row) return null;
        const prize = roll();
        await tx.update(wheelSpins).set({ coins: prize.coins, spunAt: new Date() }).where(eq(wheelSpins.id, row.id));
        const out = await applyLedgerEntry(tx, { userId, delta: prize.coins, reason: 'wheel_spin', refType: 'match', refId: row.matchId, idempotencyKey: `wheel_spin:${row.id}` });
        const [left] = await tx.select({ n: sql<number>`COUNT(*)` }).from(wheelSpins).where(and(eq(wheelSpins.userId, userId), isNull(wheelSpins.spunAt)));
        return { ...prize, pending: Number(left?.n ?? 0), balance: out.balance };
      }),
  };
}

/** In-memory twin for tests. */
export function createMemoryWheelStore(): WheelStore & { balances: Map<string, number>; spins: { userId: string; matchId: string; coins: number | null }[] } {
  const balances = new Map<string, number>();
  const spins: { userId: string; matchId: string; coins: number | null }[] = [];
  const waiting = (u: string) => spins.filter((s) => s.userId === u && s.coins === null);
  return {
    balances,
    spins,
    async grant(userId, matchId) {
      if (spins.some((s) => s.userId === userId && s.matchId === matchId)) return false;
      spins.push({ userId, matchId, coins: null });
      return true;
    },
    async pending(u) {
      return waiting(u).length;
    },
    async balance(u) {
      return balances.get(u) ?? 0;
    },
    async spin(userId, roll) {
      const next = waiting(userId)[0];
      if (!next) return null;
      const prize = roll();
      next.coins = prize.coins;
      balances.set(userId, (balances.get(userId) ?? 0) + prize.coins);
      return { ...prize, pending: waiting(userId).length, balance: balances.get(userId)! };
    },
  };
}
