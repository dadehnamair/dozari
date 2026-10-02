import { eq, userBalances, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { PlayerProfile } from './match-service.js';

/** Player card for a match; `levelOf` supplies the real level (everyone is level 1 without it). */
export function createDbProfileLookup(db: Db, levelOf?: (userId: string) => Promise<number>): (userId: string) => Promise<PlayerProfile | null> {
  return async (userId) => {
    const [row] = await db
      .select({ nickname: users.nickname, avatarKey: users.avatarKey, balance: userBalances.balance })
      .from(users)
      .leftJoin(userBalances, eq(userBalances.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    return row ? { nickname: row.nickname, avatarKey: row.avatarKey, level: (await levelOf?.(userId)) ?? 1, coins: row.balance ?? 0 } : null;
  };
}
