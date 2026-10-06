import { coinLedger, count, desc, eq, gte, sql, userBalances, users } from '@dozari/db';
import type { Db } from '@dozari/db';

/** One reason of the coin ledger over the window: coins that came in (faucets), went out (sinks) and how many rows. */
export interface EconomyFlowRow {
  reason: string;
  faucet: number;
  sink: number;
  entries: number;
}

export interface EconomyOverview {
  days: number;
  /** Coins held by real players right now, how many of them hold any, and the biggest holders. */
  circulation: { coins: number; holders: number; top: { id: string; nickname: string; balance: number }[] };
  /** Per reason, biggest movement first. */
  flow: EconomyFlowRow[];
  totals: { faucet: number; sink: number; net: number };
  /** Per day (oldest first): coins in and out. */
  daily: { day: string; faucet: number; sink: number }[];
  /** The biggest single movements in the window (a quick look for abuse or a bug). */
  big: { at: number; userId: string; nickname: string; delta: number; reason: string }[];
}

export interface EconomyAdmin {
  overview(days: number, now: number): Promise<EconomyOverview>;
}

/** A single movement this large is listed in «حرکت‌های بزرگ». */
export const BIG_MOVEMENT_COINS = 500;

const faucetSql = sql<number>`COALESCE(SUM(CASE WHEN ${coinLedger.delta} > 0 THEN ${coinLedger.delta} ELSE 0 END), 0)`;
const sinkSql = sql<number>`COALESCE(SUM(CASE WHEN ${coinLedger.delta} < 0 THEN -${coinLedger.delta} ELSE 0 END), 0)`;

/** Read-only numbers for the admin «سلامت اقتصاد» page (docs/logic/economy.md): where coins come from and where they go. Bots are left out of the holders. */
export function createDbEconomyAdmin(db: Db): EconomyAdmin {
  return {
    async overview(days, now) {
      const since = new Date(now - days * 86_400_000);
      const [held] = await db
        .select({ coins: sql<number>`COALESCE(SUM(${userBalances.balance}), 0)`, holders: sql<number>`COALESCE(SUM(CASE WHEN ${userBalances.balance} > 0 THEN 1 ELSE 0 END), 0)` })
        .from(userBalances)
        .innerJoin(users, eq(users.id, userBalances.userId))
        .where(eq(users.isBot, false));
      const top = await db
        .select({ id: users.id, nickname: users.nickname, balance: userBalances.balance })
        .from(userBalances)
        .innerJoin(users, eq(users.id, userBalances.userId))
        .where(eq(users.isBot, false))
        .orderBy(desc(userBalances.balance))
        .limit(10);
      const flowRows = await db
        .select({ reason: coinLedger.reason, faucet: faucetSql, sink: sinkSql, entries: count() })
        .from(coinLedger)
        .where(gte(coinLedger.createdAt, since))
        .groupBy(coinLedger.reason);
      const flow: EconomyFlowRow[] = flowRows
        .map((r) => ({ reason: r.reason, faucet: Number(r.faucet), sink: Number(r.sink), entries: Number(r.entries) }))
        .sort((a, b) => b.faucet + b.sink - (a.faucet + a.sink));
      const dayExpr = sql<string>`DATE(${coinLedger.createdAt})`;
      const dailyRows = await db.select({ day: dayExpr, faucet: faucetSql, sink: sinkSql }).from(coinLedger).where(gte(coinLedger.createdAt, since)).groupBy(dayExpr).orderBy(dayExpr);
      const bigRows = await db
        .select({ at: coinLedger.createdAt, userId: coinLedger.userId, nickname: users.nickname, delta: coinLedger.delta, reason: coinLedger.reason })
        .from(coinLedger)
        .innerJoin(users, eq(users.id, coinLedger.userId))
        .where(sql`${coinLedger.createdAt} >= ${since} AND ABS(${coinLedger.delta}) >= ${BIG_MOVEMENT_COINS}`)
        .orderBy(desc(coinLedger.createdAt))
        .limit(20);
      const faucet = flow.reduce((a, r) => a + r.faucet, 0);
      const sink = flow.reduce((a, r) => a + r.sink, 0);
      return {
        days,
        circulation: { coins: Number(held?.coins ?? 0), holders: Number(held?.holders ?? 0), top },
        flow,
        totals: { faucet, sink, net: faucet - sink },
        daily: dailyRows.map((r) => ({ day: String(r.day).slice(0, 10), faucet: Number(r.faucet), sink: Number(r.sink) })),
        big: bigRows.map((r) => ({ at: r.at.getTime(), userId: r.userId, nickname: r.nickname, delta: r.delta, reason: r.reason })),
      };
    },
  };
}
