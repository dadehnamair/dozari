import { eq, groupRewards, sql, userStats, xpEvents } from '@dozari/db';
import type { Db } from '@dozari/db';
import { and } from '@dozari/db';
import { groupRewardFor } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';
import { applyLedgerEntry } from '../economy/ledger.js';

export interface GroupPayout {
  coins: number;
  xp: number;
}

/** I/O boundary of the group-play reward (docs/logic/group-game.md §Account rewards). */
export interface GroupRewardStore {
  /** Adds `points` to the account's tally for the day and pays whatever the tally now earns beyond what was already paid. */
  credit(userId: string, dateKey: string, points: number): Promise<GroupPayout>;
}

export function createDbGroupRewardStore(db: Db): GroupRewardStore {
  return {
    credit: (userId, dateKey, points) =>
      db.transaction(async (tx) => {
        await tx.insert(groupRewards).ignore().values({ userId, dateKey });
        // the row lock serialises a player's concurrent taps in several groups
        const [row] = await tx.select().from(groupRewards).where(and(eq(groupRewards.userId, userId), eq(groupRewards.dateKey, dateKey))).for('update');
        const total = (row?.points ?? 0) + points;
        const owed = groupRewardFor(total);
        const coins = Math.max(0, owed.coins - (row?.coins ?? 0));
        const xp = Math.max(0, owed.xp - (row?.xp ?? 0));
        let paidCoins = 0;
        if (coins > 0) {
          // the key names the day's cumulative amount, so a replay of the same step cannot pay twice
          const out = await applyLedgerEntry(tx, { userId, delta: coins, reason: 'group_play', refType: 'group_play', refId: dateKey, idempotencyKey: `group_play:${userId}:${dateKey}:${owed.coins}` });
          if (out.applied) paidCoins = coins;
        }
        if (xp > 0) {
          await tx.insert(userStats).values({ userId, xp }).onDuplicateKeyUpdate({ set: { xp: sql`${userStats.xp} + ${xp}`, updatedAt: new Date() } });
          await tx.insert(xpEvents).values({ id: uuidv7(), userId, xp });
        }
        await tx.update(groupRewards).set({ points: total, coins: (row?.coins ?? 0) + paidCoins, xp: (row?.xp ?? 0) + xp }).where(and(eq(groupRewards.userId, userId), eq(groupRewards.dateKey, dateKey)));
        return { coins: paidCoins, xp };
      }),
  };
}

