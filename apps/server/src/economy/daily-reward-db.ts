import { and, asc, dailyRewardSteps, eq, sql, userBalances, userDailyRewards, userInventory } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { DailyRewardState } from '@dozari/shared';
import { decideClaim } from './daily-reward.js';
import type { ClaimResult, DailyRewardStore } from './daily-reward.js';
import { applyLedgerEntry } from './ledger.js';

export function createDbDailyRewardStore(db: Db): DailyRewardStore {
  return {
    async getSteps() {
      const rows = await db.select().from(dailyRewardSteps).orderBy(asc(dailyRewardSteps.day));
      return rows.length === 0 ? null : rows.map((r) => r.coins);
    },

    async setSteps(steps) {
      await db.transaction(async (tx) => {
        await tx.delete(dailyRewardSteps);
        await tx.insert(dailyRewardSteps).values(steps.map((coins, i) => ({ day: i + 1, coins })));
      });
    },

    async getState(userId) {
      const [row] = await db.select().from(userDailyRewards).where(eq(userDailyRewards.userId, userId)).limit(1);
      const [bal] = await db.select({ balance: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId)).limit(1);
      const state: DailyRewardState = row ? { lastClaimedAt: row.lastClaimedAt.getTime(), streakDay: row.streakDay } : { lastClaimedAt: null, streakDay: 0 };
      const [inv] = await db.select({ qty: userInventory.qty }).from(userInventory).where(and(eq(userInventory.userId, userId), eq(userInventory.effect, 'streak_shield')));
      return { state, balance: bal?.balance ?? 0, shields: inv?.qty ?? 0 };
    },

    async claim(userId, now, steps, rules): Promise<ClaimResult> {
      return db.transaction(async (tx) => {
        // Lock this player's state row (created empty-but-claimable on first sight) so two taps cannot both pay.
        await tx.insert(userDailyRewards).values({ userId, lastClaimedAt: new Date(0), streakDay: 0, claimsTotal: 0 }).onDuplicateKeyUpdate({ set: { userId } });
        const [row] = await tx.select().from(userDailyRewards).where(eq(userDailyRewards.userId, userId)).for('update');
        if (!row) throw new Error('daily reward row missing');
        const state: DailyRewardState = row.claimsTotal === 0 ? { lastClaimedAt: null, streakDay: 0 } : { lastClaimedAt: row.lastClaimedAt.getTime(), streakDay: row.streakDay };

        const [inv] = await tx.select({ qty: userInventory.qty }).from(userInventory).where(and(eq(userInventory.userId, userId), eq(userInventory.effect, 'streak_shield'))).for('update');
        const d = decideClaim(state, steps, now, rules, inv?.qty ?? 0);
        if (d.kind === 'disabled') return { ok: false, error: 'DISABLED' };
        if (d.kind === 'wait') return { ok: false, error: 'TOO_EARLY', nextClaimAt: d.nextClaimAt };

        const claimNo = row.claimsTotal + 1;
        const ledger = await applyLedgerEntry(tx, {
          userId,
          delta: d.coins,
          reason: 'daily_login',
          refType: 'daily_reward',
          refId: String(claimNo),
          idempotencyKey: `daily_login:${claimNo}:${userId}`,
        });
        if (!ledger.applied) throw new Error(`daily reward ledger entry refused: ${ledger.reason}`);
        await tx
          .update(userDailyRewards)
          .set({ lastClaimedAt: new Date(now), streakDay: d.next.streakDay, claimsTotal: claimNo })
          .where(eq(userDailyRewards.userId, userId));
        if (d.shield) await tx.update(userInventory).set({ qty: sql`${userInventory.qty} - 1` }).where(and(eq(userInventory.userId, userId), eq(userInventory.effect, 'streak_shield')));
        return { ok: true, day: d.day, coins: d.coins, balance: ledger.balance, nextClaimAt: d.nextClaimAt, ...(d.shield ? { shieldUsed: true } : {}) };
      });
    },
  };
}
