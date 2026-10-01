import { eq, userBalances, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { PlayerProfile } from './match-service.js';

/** Level system is not built yet (docs/logic/progression.md), so everyone is level 1 for now. */
export function createDbProfileLookup(db: Db): (userId: string) => Promise<PlayerProfile | null> {
  return async (userId) => {
    const [row] = await db
      .select({ nickname: users.nickname, avatarKey: users.avatarKey, balance: userBalances.balance })
      .from(users)
      .leftJoin(userBalances, eq(userBalances.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    return row ? { nickname: row.nickname, avatarKey: row.avatarKey, level: 1, coins: row.balance ?? 0 } : null;
  };
}
