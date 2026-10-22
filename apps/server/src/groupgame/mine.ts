import { botGroupScores, eq, groupRewards, and, sql } from '@dozari/db';
import type { Db } from '@dozari/db';
import { GROUP_COINS_DAILY_CAP, GROUP_XP_DAILY_CAP } from '@dozari/shared';
import type { GroupStats } from '@dozari/shared';

const num = (v: unknown) => Number(v ?? 0);

/** One player's group-play numbers (`GET /me/group-stats`). */
export function createDbGroupMine(db: Db) {
  return {
    async stats(userId: string, weekKey: string, dateKey: string): Promise<GroupStats> {
      const [t] = await db
        .select({
          points: sql<number>`COALESCE(SUM(${botGroupScores.points}), 0)`,
          groups: sql<number>`COALESCE(SUM(${botGroupScores.groups}), 0)`,
          wrong: sql<number>`COALESCE(SUM(${botGroupScores.wrong}), 0)`,
          groupCount: sql<number>`COUNT(DISTINCT ${botGroupScores.chatId})`,
          weekPoints: sql<number>`COALESCE(SUM(CASE WHEN ${botGroupScores.weekKey} = ${weekKey} THEN ${botGroupScores.points} ELSE 0 END), 0)`,
        })
        .from(botGroupScores)
        .where(eq(botGroupScores.userId, userId));
      const [paid] = await db
        .select({ coins: sql<number>`COALESCE(SUM(${groupRewards.coins}), 0)`, xp: sql<number>`COALESCE(SUM(${groupRewards.xp}), 0)` })
        .from(groupRewards)
        .where(eq(groupRewards.userId, userId));
      const [today] = await db
        .select({ coins: groupRewards.coins, xp: groupRewards.xp })
        .from(groupRewards)
        .where(and(eq(groupRewards.userId, userId), eq(groupRewards.dateKey, dateKey)));
      return {
        points: num(t?.points),
        groups: num(t?.groups),
        wrong: num(t?.wrong),
        groupCount: num(t?.groupCount),
        weekPoints: num(t?.weekPoints),
        today: { coins: today?.coins ?? 0, xp: today?.xp ?? 0, coinsCap: GROUP_COINS_DAILY_CAP, xpCap: GROUP_XP_DAILY_CAP },
        totalCoins: num(paid?.coins),
        totalXp: num(paid?.xp),
      };
    },
  };
}

export type GroupMine = ReturnType<typeof createDbGroupMine>;
