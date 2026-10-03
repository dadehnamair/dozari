import { baleLinks, eq, profileTaskClaims, userBalances, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import { PROFILE_TASK_KEYS } from '@dozari/shared';
import type { ProfileTaskKey } from '@dozari/shared';
import { applyLedgerEntry } from '../economy/ledger.js';
import type { ProfileTaskDeps } from './tasks.js';

/** Persistence of the profile-completion rewards: what the player filled in, and the one-time payment. */
export function createDbProfileTaskStore(db: Db): Pick<ProfileTaskDeps, 'facts' | 'claimedKeys' | 'pay'> {
  return {
    async facts(userId) {
      const [u] = await db.select({ gender: users.gender, cityId: users.cityId, phoneVerifiedAt: users.phoneVerifiedAt }).from(users).where(eq(users.id, userId));
      const [bale] = await db.select({ id: baleLinks.userId }).from(baleLinks).where(eq(baleLinks.userId, userId));
      return { gender: !!u?.gender, city: !!u?.cityId, phone: !!u?.phoneVerifiedAt, bale: !!bale };
    },
    async claimedKeys(userId) {
      const rows = await db.select({ key: profileTaskClaims.taskKey }).from(profileTaskClaims).where(eq(profileTaskClaims.userId, userId));
      return rows.map((r) => r.key).filter((k): k is ProfileTaskKey => (PROFILE_TASK_KEYS as readonly string[]).includes(k));
    },
    pay: (userId, key, coins) =>
      db.transaction(async (tx) => {
        // The claim row is the lock: a second tap inserts nothing and pays nothing.
        const [res] = await tx.insert(profileTaskClaims).ignore().values({ userId, taskKey: key });
        if (res.affectedRows < 1) return null;
        const out = await applyLedgerEntry(tx, { userId, delta: coins, reason: 'profile_task', refType: 'profile_task', refId: key, idempotencyKey: `profile_task:${userId}:${key}` });
        if (!out.applied) return null;
        const [b] = await tx.select({ b: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId));
        return { balance: b?.b ?? out.balance };
      }),
  };
}
