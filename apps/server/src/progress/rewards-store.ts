import { eq, levelRewardClaims, userBalances } from '@dozari/db';
import type { Db } from '@dozari/db';
import { applyLedgerEntry } from '../economy/ledger.js';

/** Level-road reward persistence: which levels a player took, and the payment through the ledger. */
export function createDbRewardStore(db: Db) {
  return {
    async claimedLevels(userId: string): Promise<number[]> {
      const rows = await db.select({ level: levelRewardClaims.level }).from(levelRewardClaims).where(eq(levelRewardClaims.userId, userId));
      return rows.map((r) => r.level);
    },
    payRewards: (userId: string, rewards: { level: number; coins: number }[]) =>
      db.transaction(async (tx) => {
        const paid: { level: number; coins: number }[] = [];
        for (const r of rewards) {
          // The claim row is the lock: a second tap inserts nothing and pays nothing.
          const [res] = await tx.insert(levelRewardClaims).ignore().values({ userId, level: r.level });
          if (res.affectedRows < 1) continue;
          const out = await applyLedgerEntry(tx, { userId, delta: r.coins, reason: 'level_reward', refType: 'level', refId: String(r.level), idempotencyKey: `level_reward:${userId}:${r.level}` });
          if (out.applied) paid.push(r);
        }
        const [b] = await tx.select({ b: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId));
        return { paid, balance: b?.b ?? 0 };
      }),
  };
}
