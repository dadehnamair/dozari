import { botGroupPlays, botGroupPriceSessions, botGroupScores, botGroups, groupRewards, puzzlePlays, sql, userClients, users } from '@dozari/db';
import type { Db } from '@dozari/db';

export interface GroupStats {
  groups: { total: number; active: number; bale: number; telegram: number; new7d: number; new30d: number };
  /** Activity inside the window. */
  window: { days: number; plays: number; won: number; lost: number; playing: number; activeGroups: number; players: number; priceSessions: number };
  /** Accounts that arrived through a group's link (docs/logic/group-game.md §Funnel). */
  funnel: {
    /** New accounts (first seen with a group source) inside the window. */
    referred: number;
    /** …of which played at least one board. */
    referredPlayed: number;
    /** …of which were seen in the last 7 days. */
    referredActive7d: number;
    /** All-time new accounts via groups, and all accounts that ever opened a group link (new or existing). */
    referredAll: number;
    touchedAll: number;
  };
  /** Group points paid to linked accounts as XP and coins (docs/logic/group-game.md §Account rewards). */
  rewards: {
    /** Accounts ever seen behind a group score, and accounts paid inside the window. */
    linkedAll: number;
    paidAccounts: number;
    coins: number;
    xp: number;
    questionSessions: number;
    top: { userId: string; nickname: string; points: number; coins: number; xp: number }[];
  };
  daily: { day: string; plays: number; groups: number }[];
  top: { chatId: string; title: string; platform: string; addedAt: number; removed: boolean; plays: number; won: number; players: number; priceSessions: number; referred: number; referredPlayed: number }[];
}

export interface GroupStatsAdmin {
  groups(now: number, days: number): Promise<GroupStats>;
}

const DAY = 86_400_000;
const num = (v: unknown) => Number(v ?? 0);
/** Tehran is UTC+3:30 all year; day keys are shifted by that. */
const TEHRAN_OFFSET_MIN = 210;

export function createDbGroupStats(db: Db): GroupStatsAdmin {
  return {
    async groups(now, days) {
      const since = new Date(now - days * DAY);
      const d7 = new Date(now - 7 * DAY);
      const d30 = new Date(now - 30 * DAY);

      const [g] = await db
        .select({
          total: sql<number>`COUNT(*)`,
          active: sql<number>`SUM(${botGroups.removedAt} IS NULL)`,
          bale: sql<number>`SUM(${botGroups.platform} = 'bale')`,
          telegram: sql<number>`SUM(${botGroups.platform} = 'telegram')`,
          new7d: sql<number>`SUM(${botGroups.addedAt} >= ${d7})`,
          new30d: sql<number>`SUM(${botGroups.addedAt} >= ${d30})`,
        })
        .from(botGroups);

      const [w] = await db
        .select({
          plays: sql<number>`COUNT(*)`,
          won: sql<number>`SUM(${botGroupPlays.result} = 'won')`,
          lost: sql<number>`SUM(${botGroupPlays.result} = 'lost')`,
          playing: sql<number>`SUM(${botGroupPlays.result} = 'playing')`,
          groups: sql<number>`COUNT(DISTINCT ${botGroupPlays.chatId})`,
          players: sql<number>`COALESCE(SUM(${botGroupPlays.players}), 0)`,
        })
        .from(botGroupPlays)
        .where(sql`${botGroupPlays.startedAt} >= ${since}`);

      const dayExpr = sql<string>`DATE_FORMAT(DATE_ADD(${botGroupPlays.startedAt}, INTERVAL ${sql.raw(String(TEHRAN_OFFSET_MIN))} MINUTE), '%Y-%m-%d')`;
      const dailyRows = await db
        .select({ day: dayExpr, plays: sql<number>`COUNT(*)`, groups: sql<number>`COUNT(DISTINCT ${botGroupPlays.chatId})` })
        .from(botGroupPlays)
        .where(sql`${botGroupPlays.startedAt} >= ${since}`)
        .groupBy(dayExpr)
        .orderBy(dayExpr);

      const [ps] = await db
        .select({ n: sql<number>`COALESCE(SUM(${botGroupPriceSessions.sessions}), 0)` })
        .from(botGroupPriceSessions)
        .where(sql`${botGroupPriceSessions.dateKey} >= ${new Date(now - days * DAY + TEHRAN_OFFSET_MIN * 60_000).toISOString().slice(0, 10)}`);

      // Accounts that arrived through a group link; bots are never counted.
      const played = sql`EXISTS (SELECT 1 FROM ${puzzlePlays} WHERE ${puzzlePlays.userId} = ${userClients.userId})`;
      const [f] = await db
        .select({
          referred: sql<number>`SUM(${userClients.firstSrc} LIKE 'g%' AND ${userClients.firstSeenAt} >= ${since})`,
          referredPlayed: sql<number>`SUM(${userClients.firstSrc} LIKE 'g%' AND ${userClients.firstSeenAt} >= ${since} AND ${played})`,
          referredActive7d: sql<number>`SUM(${userClients.firstSrc} LIKE 'g%' AND ${userClients.firstSeenAt} >= ${since} AND ${userClients.updatedAt} >= ${d7})`,
          referredAll: sql<number>`SUM(${userClients.firstSrc} LIKE 'g%')`,
          touchedAll: sql<number>`SUM(${userClients.src} LIKE 'g%')`,
        })
        .from(userClients)
        .innerJoin(users, sql`${users.id} = ${userClients.userId}`)
        .where(sql`${users.isBot} = 0`);

      const topRows = await db
        .select({
          chatId: botGroups.chatId,
          title: botGroups.title,
          platform: botGroups.platform,
          addedAt: botGroups.addedAt,
          removedAt: botGroups.removedAt,
          plays: sql<number>`(SELECT COUNT(*) FROM ${botGroupPlays} p WHERE p.chat_id = ${botGroups.chatId} AND p.started_at >= ${since})`.as('plays'),
          won: sql<number>`(SELECT COUNT(*) FROM ${botGroupPlays} p WHERE p.chat_id = ${botGroups.chatId} AND p.started_at >= ${since} AND p.result = 'won')`,
          players: sql<number>`(SELECT COALESCE(SUM(p.players), 0) FROM ${botGroupPlays} p WHERE p.chat_id = ${botGroups.chatId} AND p.started_at >= ${since})`,
          priceSessions: sql<number>`(SELECT COALESCE(SUM(s.sessions), 0) FROM ${botGroupPriceSessions} s WHERE s.chat_id = ${botGroups.chatId})`,
          referred: sql<number>`(SELECT COUNT(*) FROM ${userClients} c WHERE ${botGroups.ref} IS NOT NULL AND c.first_src = CONCAT('g', ${botGroups.ref}))`.as('referred'),
          referredPlayed: sql<number>`(SELECT COUNT(*) FROM ${userClients} c WHERE ${botGroups.ref} IS NOT NULL AND c.first_src = CONCAT('g', ${botGroups.ref}) AND EXISTS (SELECT 1 FROM ${puzzlePlays} pp WHERE pp.user_id = c.user_id))`,
        })
        .from(botGroups)
        .orderBy(sql`plays DESC, referred DESC`)
        .limit(30);

      const fromKey = new Date(now - days * DAY + TEHRAN_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
      const [linked] = await db.select({ n: sql<number>`COUNT(DISTINCT ${botGroupScores.userId})` }).from(botGroupScores);
      const [paid] = await db
        .select({ accounts: sql<number>`COUNT(DISTINCT ${groupRewards.userId})`, coins: sql<number>`COALESCE(SUM(${groupRewards.coins}), 0)`, xp: sql<number>`COALESCE(SUM(${groupRewards.xp}), 0)` })
        .from(groupRewards)
        .where(sql`${groupRewards.dateKey} >= ${fromKey}`);
      const [qs] = await db.select({ n: sql<number>`COALESCE(SUM(${botGroupPriceSessions.questionSessions}), 0)` }).from(botGroupPriceSessions).where(sql`${botGroupPriceSessions.dateKey} >= ${fromKey}`);
      const rewardTop = await db
        .select({ userId: groupRewards.userId, nickname: users.nickname, points: sql<number>`SUM(${groupRewards.points})`, coins: sql<number>`SUM(${groupRewards.coins})`, xp: sql<number>`SUM(${groupRewards.xp})` })
        .from(groupRewards)
        .innerJoin(users, sql`${users.id} = ${groupRewards.userId}`)
        .where(sql`${groupRewards.dateKey} >= ${fromKey}`)
        .groupBy(groupRewards.userId, users.nickname)
        .orderBy(sql`SUM(${groupRewards.points}) DESC`)
        .limit(15);

      return {
        groups: { total: num(g?.total), active: num(g?.active), bale: num(g?.bale), telegram: num(g?.telegram), new7d: num(g?.new7d), new30d: num(g?.new30d) },
        window: { days, plays: num(w?.plays), won: num(w?.won), lost: num(w?.lost), playing: num(w?.playing), activeGroups: num(w?.groups), players: num(w?.players), priceSessions: num(ps?.n) },
        funnel: { referred: num(f?.referred), referredPlayed: num(f?.referredPlayed), referredActive7d: num(f?.referredActive7d), referredAll: num(f?.referredAll), touchedAll: num(f?.touchedAll) },
        rewards: { linkedAll: num(linked?.n), paidAccounts: num(paid?.accounts), coins: num(paid?.coins), xp: num(paid?.xp), questionSessions: num(qs?.n), top: rewardTop.map((r) => ({ userId: r.userId, nickname: r.nickname ?? '', points: num(r.points), coins: num(r.coins), xp: num(r.xp) })) },
        daily: dailyRows.map((r) => ({ day: r.day, plays: num(r.plays), groups: num(r.groups) })),
        top: topRows.map((r) => ({
          chatId: r.chatId,
          title: r.title,
          platform: r.platform,
          addedAt: r.addedAt.getTime(),
          removed: r.removedAt !== null,
          plays: num(r.plays),
          won: num(r.won),
          players: num(r.players),
          priceSessions: num(r.priceSessions),
          referred: num(r.referred),
          referredPlayed: num(r.referredPlayed),
        })),
      };
    },
  };
}
