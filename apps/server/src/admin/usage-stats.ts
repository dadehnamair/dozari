import { and, desc, eq, gte, puzzlePlays, puzzles, sql, userClients, users } from '@dozari/db';
import type { Db } from '@dozari/db';

/** Where an install came from, as the admin sees it. `direct_android` = an Android build with no market tag (APK from the site, development). */
export type InstallChannel = 'bazaar' | 'myket' | 'bale' | 'direct_android' | 'ios' | 'pwa' | 'web';
export const INSTALL_CHANNELS: readonly InstallChannel[] = ['bazaar', 'myket', 'bale', 'direct_android', 'ios', 'pwa', 'web'];

/** Pure: the channel of one device row. The market the account was first seen through wins; a web row is a PWA once it runs installed. */
export function installChannel(platform: string, pwa: boolean, firstStore: string | null): InstallChannel {
  if (platform === 'web') return pwa ? 'pwa' : 'web';
  if (platform === 'ios') return 'ios';
  if (firstStore === 'bazaar' || firstStore === 'myket' || firstStore === 'bale') return firstStore;
  return 'direct_android';
}

export interface ChannelStat {
  channel: InstallChannel;
  /** Accounts first seen through this channel. */
  total: number;
  new1d: number;
  new7d: number;
  new30d: number;
  /** Accounts whose app reported in the last day / week. */
  active1d: number;
  active7d: number;
}

export interface InstallStats {
  /** Accounts that have no device row yet (signed up before the app reported its details, or never opened a new build). */
  unknown: number;
  total: number;
  channels: ChannelStat[];
  /** Accounts per app build inside each channel, newest build first. */
  builds: { channel: InstallChannel; build: number | null; count: number }[];
  /** Accounts that now use a different market's build than the one they were first seen in. */
  switched: number;
  /** New accounts per Tehran day for the last 30 days, by channel. */
  daily: { day: string; channel: InstallChannel; count: number }[];
}

export interface GameplayStats {
  sinceDays: number;
  plays: number;
  players: number;
  /** Distinct puzzles used / puzzles in the library / puzzles in the library nobody has played in the window. */
  puzzlesUsed: number;
  puzzlesTotal: number;
  puzzlesUnplayed: number;
  wins: number;
  losses: number;
  draws: number;
  groupsSolved: number;
  mistakes: number;
  hintsUsed: number;
  /** Boards by how many groups the player found, index 0..4. */
  groupsHistogram: number[];
  byMode: { mode: string; plays: number; wins: number; groupsSolved: number; mistakes: number }[];
  daily: { day: string; plays: number; players: number }[];
  topPuzzles: { puzzleId: string; plays: number; wins: number; mistakes: number }[];
}

export interface PlayerPlayRow {
  userId: string;
  nickname: string;
  plays: number;
  wins: number;
  losses: number;
  draws: number;
  groupsSolved: number;
  mistakes: number;
  hintsUsed: number;
  puzzlesUsed: number;
  lastPlayedAt: number | null;
}

export interface UsageStatsAdmin {
  installs(now: number): Promise<InstallStats>;
  gameplay(now: number, days: number): Promise<GameplayStats>;
  players(now: number, days: number, limit: number, sort: PlayerSort): Promise<PlayerPlayRow[]>;
}

export const PLAYER_SORTS = ['plays', 'wins', 'groups', 'mistakes', 'hints', 'puzzles', 'recent'] as const;
export type PlayerSort = (typeof PLAYER_SORTS)[number];

const DAY = 86_400_000;
const num = (v: unknown) => Number(v ?? 0);
/** Tehran is UTC+3:30 all year since 2022; the day keys of the charts are shifted by that. */
const TEHRAN_OFFSET_MIN = 210;

export function createDbUsageStats(db: Db): UsageStatsAdmin {
  return {
    async installs(now) {
      const d1 = new Date(now - DAY);
      const d7 = new Date(now - 7 * DAY);
      const d30 = new Date(now - 30 * DAY);
      const rows = await db
        .select({
          platform: userClients.platform,
          pwa: userClients.pwa,
          store: userClients.store,
          firstStore: userClients.firstStore,
          build: userClients.appBuild,
          total: sql<number>`COUNT(*)`,
          new1d: sql<number>`SUM(${userClients.firstSeenAt} >= ${d1})`,
          new7d: sql<number>`SUM(${userClients.firstSeenAt} >= ${d7})`,
          new30d: sql<number>`SUM(${userClients.firstSeenAt} >= ${d30})`,
          active1d: sql<number>`SUM(${userClients.updatedAt} >= ${d1})`,
          active7d: sql<number>`SUM(${userClients.updatedAt} >= ${d7})`,
        })
        .from(userClients)
        .innerJoin(users, eq(users.id, userClients.userId))
        .where(eq(users.isBot, false))
        .groupBy(userClients.platform, userClients.pwa, userClients.store, userClients.firstStore, userClients.appBuild);

      const byChannel = new Map<InstallChannel, ChannelStat>(INSTALL_CHANNELS.map((c) => [c, { channel: c, total: 0, new1d: 0, new7d: 0, new30d: 0, active1d: 0, active7d: 0 }]));
      const builds = new Map<string, { channel: InstallChannel; build: number | null; count: number }>();
      let switched = 0;
      for (const r of rows) {
        const channel = installChannel(r.platform, r.pwa, r.firstStore);
        const c = byChannel.get(channel)!;
        c.total += num(r.total);
        c.new1d += num(r.new1d);
        c.new7d += num(r.new7d);
        c.new30d += num(r.new30d);
        c.active1d += num(r.active1d);
        c.active7d += num(r.active7d);
        const key = `${channel}|${r.build ?? ''}`;
        const b = builds.get(key) ?? { channel, build: r.build ?? null, count: 0 };
        b.count += num(r.total);
        builds.set(key, b);
        if (r.platform === 'android' && r.store && r.firstStore && r.store !== r.firstStore) switched += num(r.total);
      }

      const dayExpr = sql<string>`DATE_FORMAT(DATE_ADD(${userClients.firstSeenAt}, INTERVAL ${sql.raw(String(TEHRAN_OFFSET_MIN))} MINUTE), '%Y-%m-%d')`;
      const dailyRows = await db
        .select({ day: dayExpr, platform: userClients.platform, pwa: userClients.pwa, firstStore: userClients.firstStore, n: sql<number>`COUNT(*)` })
        .from(userClients)
        .innerJoin(users, eq(users.id, userClients.userId))
        .where(and(eq(users.isBot, false), gte(userClients.firstSeenAt, d30)))
        .groupBy(dayExpr, userClients.platform, userClients.pwa, userClients.firstStore);
      const daily = new Map<string, { day: string; channel: InstallChannel; count: number }>();
      for (const r of dailyRows) {
        const channel = installChannel(r.platform, r.pwa, r.firstStore);
        const key = `${r.day}|${channel}`;
        const cur = daily.get(key) ?? { day: r.day, channel, count: 0 };
        cur.count += num(r.n);
        daily.set(key, cur);
      }

      const [acc] = await db.select({ n: sql<number>`COUNT(*)` }).from(users).where(eq(users.isBot, false));
      const accounts = acc?.n;
      const known = [...byChannel.values()].reduce((s, c) => s + c.total, 0);
      return {
        unknown: Math.max(0, num(accounts) - known),
        total: num(accounts),
        channels: [...byChannel.values()],
        builds: [...builds.values()].sort((a, b) => (b.build ?? 0) - (a.build ?? 0) || b.count - a.count),
        switched,
        daily: [...daily.values()].sort((a, b) => a.day.localeCompare(b.day)),
      };
    },

    async gameplay(now, days) {
      const since = new Date(now - days * DAY);
      const real = and(eq(users.isBot, false), gte(puzzlePlays.createdAt, since));
      const [tot] = await db
        .select({
          plays: sql<number>`COUNT(*)`,
          players: sql<number>`COUNT(DISTINCT ${puzzlePlays.userId})`,
          puzzlesUsed: sql<number>`COUNT(DISTINCT ${puzzlePlays.puzzleId})`,
          wins: sql<number>`COALESCE(SUM(${puzzlePlays.outcome} = 'win'), 0)`,
          losses: sql<number>`COALESCE(SUM(${puzzlePlays.outcome} = 'loss'), 0)`,
          draws: sql<number>`COALESCE(SUM(${puzzlePlays.outcome} = 'draw'), 0)`,
          groups: sql<number>`COALESCE(SUM(${puzzlePlays.groupsSolved}), 0)`,
          mistakes: sql<number>`COALESCE(SUM(${puzzlePlays.mistakes}), 0)`,
          hints: sql<number>`COALESCE(SUM(${puzzlePlays.hintsUsed}), 0)`,
        })
        .from(puzzlePlays)
        .innerJoin(users, eq(users.id, puzzlePlays.userId))
        .where(real);
      const hist = await db
        .select({ g: puzzlePlays.groupsSolved, n: sql<number>`COUNT(*)` })
        .from(puzzlePlays)
        .innerJoin(users, eq(users.id, puzzlePlays.userId))
        .where(real)
        .groupBy(puzzlePlays.groupsSolved);
      const modes = await db
        .select({
          mode: puzzlePlays.mode,
          plays: sql<number>`COUNT(*)`,
          wins: sql<number>`SUM(${puzzlePlays.outcome} = 'win')`,
          groups: sql<number>`SUM(${puzzlePlays.groupsSolved})`,
          mistakes: sql<number>`SUM(${puzzlePlays.mistakes})`,
        })
        .from(puzzlePlays)
        .innerJoin(users, eq(users.id, puzzlePlays.userId))
        .where(real)
        .groupBy(puzzlePlays.mode);
      const dayExpr = sql<string>`DATE_FORMAT(DATE_ADD(${puzzlePlays.createdAt}, INTERVAL ${sql.raw(String(TEHRAN_OFFSET_MIN))} MINUTE), '%Y-%m-%d')`;
      const perDay = await db
        .select({ day: dayExpr, plays: sql<number>`COUNT(*)`, players: sql<number>`COUNT(DISTINCT ${puzzlePlays.userId})` })
        .from(puzzlePlays)
        .innerJoin(users, eq(users.id, puzzlePlays.userId))
        .where(and(eq(users.isBot, false), gte(puzzlePlays.createdAt, new Date(Math.max(now - days * DAY, now - 60 * DAY)))))
        .groupBy(dayExpr)
        .orderBy(dayExpr);
      const top = await db
        .select({ puzzleId: puzzlePlays.puzzleId, plays: sql<number>`COUNT(*)`, wins: sql<number>`SUM(${puzzlePlays.outcome} = 'win')`, mistakes: sql<number>`SUM(${puzzlePlays.mistakes})` })
        .from(puzzlePlays)
        .innerJoin(users, eq(users.id, puzzlePlays.userId))
        .where(real)
        .groupBy(puzzlePlays.puzzleId)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(10);
      const [lib] = await db.select({ n: sql<number>`COUNT(*)` }).from(puzzles);
      const histogram = [0, 0, 0, 0, 0];
      for (const h of hist) if (h.g >= 0 && h.g <= 4) histogram[h.g] = num(h.n);
      const puzzlesUsed = num(tot?.puzzlesUsed);
      return {
        sinceDays: days,
        plays: num(tot?.plays),
        players: num(tot?.players),
        puzzlesUsed,
        puzzlesTotal: num(lib?.n),
        puzzlesUnplayed: Math.max(0, num(lib?.n) - puzzlesUsed),
        wins: num(tot?.wins),
        losses: num(tot?.losses),
        draws: num(tot?.draws),
        groupsSolved: num(tot?.groups),
        mistakes: num(tot?.mistakes),
        hintsUsed: num(tot?.hints),
        groupsHistogram: histogram,
        byMode: modes.map((m) => ({ mode: m.mode, plays: num(m.plays), wins: num(m.wins), groupsSolved: num(m.groups), mistakes: num(m.mistakes) })),
        daily: perDay.map((d) => ({ day: d.day, plays: num(d.plays), players: num(d.players) })),
        topPuzzles: top.map((t) => ({ puzzleId: t.puzzleId, plays: num(t.plays), wins: num(t.wins), mistakes: num(t.mistakes) })),
      };
    },

    async players(now, days, limit, sort) {
      const since = new Date(now - days * DAY);
      const order = {
        plays: sql`COUNT(*)`,
        wins: sql`SUM(${puzzlePlays.outcome} = 'win')`,
        groups: sql`SUM(${puzzlePlays.groupsSolved})`,
        mistakes: sql`SUM(${puzzlePlays.mistakes})`,
        hints: sql`SUM(${puzzlePlays.hintsUsed})`,
        puzzles: sql`COUNT(DISTINCT ${puzzlePlays.puzzleId})`,
        recent: sql`MAX(${puzzlePlays.createdAt})`,
      }[sort];
      const rows = await db
        .select({
          userId: puzzlePlays.userId,
          nickname: users.nickname,
          plays: sql<number>`COUNT(*)`,
          wins: sql<number>`SUM(${puzzlePlays.outcome} = 'win')`,
          losses: sql<number>`SUM(${puzzlePlays.outcome} = 'loss')`,
          draws: sql<number>`SUM(${puzzlePlays.outcome} = 'draw')`,
          groups: sql<number>`SUM(${puzzlePlays.groupsSolved})`,
          mistakes: sql<number>`SUM(${puzzlePlays.mistakes})`,
          hints: sql<number>`SUM(${puzzlePlays.hintsUsed})`,
          puzzlesUsed: sql<number>`COUNT(DISTINCT ${puzzlePlays.puzzleId})`,
          last: sql<Date>`MAX(${puzzlePlays.createdAt})`.mapWith(puzzlePlays.createdAt),
        })
        .from(puzzlePlays)
        .innerJoin(users, eq(users.id, puzzlePlays.userId))
        .where(and(eq(users.isBot, false), gte(puzzlePlays.createdAt, since)))
        .groupBy(puzzlePlays.userId, users.nickname)
        .orderBy(desc(order))
        .limit(limit);
      return rows.map((r) => ({
        userId: r.userId,
        nickname: r.nickname,
        plays: num(r.plays),
        wins: num(r.wins),
        losses: num(r.losses),
        draws: num(r.draws),
        groupsSolved: num(r.groups),
        mistakes: num(r.mistakes),
        hintsUsed: num(r.hints),
        puzzlesUsed: num(r.puzzlesUsed),
        lastPlayedAt: r.last ? new Date(r.last).getTime() : null,
      }));
    },
  };
}
