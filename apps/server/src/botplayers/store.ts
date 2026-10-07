import { and, asc, botPlayers, eq, inArray, userBalances, userStats, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import { LEVEL_MAX, XP_CURVE_BASE, levelInfo } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';
import { applyLedgerEntry } from '../economy/ledger.js';

export interface BotRow {
  userId: string;
  nickname: string;
  avatarKey: string;
  gender: 'female' | 'male' | null;
  cityId: string | null;
  skill: number;
  thinkMinMs: number;
  thinkMaxMs: number;
  tauntPercent: number;
  isActive: boolean;
  /** Level from the bot's XP (default curve); drives its skill band (docs/logic/bots.md §Skill by level). Absent = level 1. */
  level?: number;
}

export interface NewBot {
  nickname: string;
  avatarKey: string;
  gender: 'female' | 'male' | null;
  cityId: string | null;
  skill: number;
  thinkMinMs: number;
  thinkMaxMs: number;
  tauntPercent: number;
  coins: number;
  stats: { xp: number; games: number; wins: number; losses: number; draws: number };
}

export type BotPatch = Partial<Pick<BotRow, 'skill' | 'thinkMinMs' | 'thinkMaxMs' | 'tauntPercent' | 'isActive' | 'cityId'>>;

/** I/O boundary of bot players: the roster and their creation (an ordinary account row flagged `is_bot`, plus its behaviour). */
export interface BotPlayerStore {
  list(): Promise<(BotRow & { xp: number; games: number; wins: number; coins: number })[]>;
  /** Active bots only: what the driver needs to pick an opponent or a city mate. */
  active(): Promise<BotRow[]>;
  create(bot: NewBot): Promise<string>;
  update(userId: string, patch: BotPatch): Promise<'ok' | 'not_found'>;
  nicknames(): Promise<Set<string>>;
}

export function createDbBotPlayerStore(db: Db): BotPlayerStore {
  const rows = async (onlyActive: boolean) => {
    const q = db
      .select({ b: botPlayers, u: users, s: userStats, bal: userBalances.balance })
      .from(botPlayers)
      .innerJoin(users, eq(users.id, botPlayers.userId))
      .leftJoin(userStats, eq(userStats.userId, users.id))
      .leftJoin(userBalances, eq(userBalances.userId, users.id));
    const out = await (onlyActive ? q.where(and(eq(botPlayers.isActive, true), eq(users.isBanned, false))) : q).orderBy(asc(users.nickname));
    return out.map(({ b, u, s, bal }) => ({ userId: b.userId, nickname: u.nickname, avatarKey: u.avatarKey, gender: u.gender, cityId: u.cityId, skill: b.skill, thinkMinMs: b.thinkMinMs, thinkMaxMs: b.thinkMaxMs, tauntPercent: b.tauntPercent, isActive: b.isActive, level: levelInfo(s?.xp ?? 0, { curveBase: XP_CURVE_BASE, levelMax: LEVEL_MAX }).level, xp: s?.xp ?? 0, games: s?.games ?? 0, wins: s?.wins ?? 0, coins: bal ?? 0 }));
  };
  return {
    list: () => rows(false),
    async active() {
      return (await rows(true)).map(({ xp: _x, games: _g, wins: _w, coins: _c, ...r }) => r);
    },
    async create(bot) {
      const id = uuidv7();
      await db.transaction(async (tx) => {
        await tx.insert(users).values({ id, deviceId: null, nickname: bot.nickname, avatarKey: bot.avatarKey, gender: bot.gender, cityId: bot.cityId, isBot: true });
        await tx.insert(userStats).values({ userId: id, ...bot.stats });
        await tx.insert(botPlayers).values({ userId: id, skill: bot.skill, thinkMinMs: bot.thinkMinMs, thinkMaxMs: bot.thinkMaxMs, tauntPercent: bot.tauntPercent });
        if (bot.coins > 0) await applyLedgerEntry(tx, { userId: id, delta: bot.coins, reason: 'admin_adjust', refType: 'bot_seed', refId: id, idempotencyKey: `bot_seed:${id}` });
      });
      return id;
    },
    async update(userId, patch) {
      const [r] = await db.select({ id: botPlayers.userId }).from(botPlayers).where(eq(botPlayers.userId, userId));
      if (!r) return 'not_found';
      const { cityId, ...rest } = patch;
      if (Object.keys(rest).length > 0) await db.update(botPlayers).set(rest).where(eq(botPlayers.userId, userId));
      if (cityId !== undefined) await db.update(users).set({ cityId }).where(eq(users.id, userId));
      return 'ok';
    },
    async nicknames() {
      const r = await db.select({ n: users.nickname }).from(users).where(inArray(users.isBot, [true]));
      return new Set(r.map((x) => x.n));
    },
  };
}

export function createMemoryBotPlayerStore(): BotPlayerStore & { bots: Map<string, BotRow & { xp: number; games: number; wins: number; coins: number }> } {
  const bots = new Map<string, BotRow & { xp: number; games: number; wins: number; coins: number }>();
  let seq = 0;
  return {
    bots,
    async list() {
      return [...bots.values()].map((b) => ({ ...b }));
    },
    async active() {
      return [...bots.values()].filter((b) => b.isActive).map(({ xp: _x, games: _g, wins: _w, coins: _c, ...r }) => ({ ...r }));
    },
    async create(bot) {
      const id = `00000000-0000-7000-c000-${String(++seq).padStart(12, '0')}`;
      bots.set(id, { userId: id, nickname: bot.nickname, avatarKey: bot.avatarKey, gender: bot.gender, cityId: bot.cityId, skill: bot.skill, thinkMinMs: bot.thinkMinMs, thinkMaxMs: bot.thinkMaxMs, tauntPercent: bot.tauntPercent, isActive: true, level: levelInfo(bot.stats.xp, { curveBase: XP_CURVE_BASE, levelMax: LEVEL_MAX }).level, xp: bot.stats.xp, games: bot.stats.games, wins: bot.stats.wins, coins: bot.coins });
      return id;
    },
    async update(userId, patch) {
      const b = bots.get(userId);
      if (!b) return 'not_found';
      Object.assign(b, patch);
      return 'ok';
    },
    async nicknames() {
      return new Set([...bots.values()].map((b) => b.nickname));
    },
  };
}
