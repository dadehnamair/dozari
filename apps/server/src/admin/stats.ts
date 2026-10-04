import { ageBandCounts, todayInTehran } from '@dozari/shared';
import { botRuns, coinLedger, count, desc, eq, gte, priceCandidates, pricePoints, products, puzzles, sql, userBalances, users } from '@dozari/db';
import type { Db } from '@dozari/db';

export interface DashboardStats {
  users: { total: number; newToday: number; activeToday: number; banned: number };
  /** Players per age band (aggregate only) and how many gave no birth date. */
  ageBands: { key: string; count: number }[];
  ageUnknown: number;
  catalog: { products: number; activeProducts: number; withoutIcon: number; withoutApprovedPrice: number; pricesPending: number; pricesApproved: number; pricesRejected: number };
  puzzles: number;
  economy: { coinsInCirculation: number; dailyClaimsToday: number };
  bot: { candidatesPending: number; lastRunAt: number | null; lastRunStatus: string | null };
}

export interface StatsAdmin {
  dashboard(now: number): Promise<DashboardStats>;
}

const dayAgo = (now: number) => new Date(now - 24 * 3_600_000);

export function createDbStatsAdmin(db: Db): StatsAdmin {
  const one = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
  return {
    async dashboard(now) {
      const since = dayAgo(now);
      const [uTotal, uNew, uActive, uBanned, pTotal, pActive, pNoIcon, pNoPrice, prPending, prApproved, prRejected, nPuzzles, circulation, claims, pending] = await Promise.all([
        one(db.select({ n: count() }).from(users)),
        one(db.select({ n: count() }).from(users).where(gte(users.createdAt, since))),
        one(db.select({ n: count() }).from(users).where(gte(users.lastSeenAt, since))),
        one(db.select({ n: count() }).from(users).where(eq(users.isBanned, true))),
        one(db.select({ n: count() }).from(products)),
        one(db.select({ n: count() }).from(products).where(eq(products.isActive, true))),
        one(db.select({ n: count() }).from(products).where(sql`${products.iconKey} IS NULL`)),
        one(db.select({ n: count() }).from(products).where(sql`NOT EXISTS (SELECT 1 FROM price_points pp WHERE pp.product_id = ${products.id} AND pp.status = 'approved')`)),
        one(db.select({ n: count() }).from(pricePoints).where(eq(pricePoints.status, 'pending'))),
        one(db.select({ n: count() }).from(pricePoints).where(eq(pricePoints.status, 'approved'))),
        one(db.select({ n: count() }).from(pricePoints).where(eq(pricePoints.status, 'rejected'))),
        one(db.select({ n: count() }).from(puzzles)),
        one(db.select({ n: sql<number>`COALESCE(SUM(${userBalances.balance}), 0)` }).from(userBalances)),
        one(db.select({ n: count() }).from(coinLedger).where(sql`${coinLedger.reason} = 'daily_login' AND ${coinLedger.createdAt} >= ${since}`)),
        one(db.select({ n: count() }).from(priceCandidates).where(eq(priceCandidates.status, 'pending'))),
      ]);
      const birthGroups = await db
        .select({ y: users.birthYear, m: users.birthMonth, d: users.birthDay, n: count() })
        .from(users)
        .where(sql`${users.birthYear} IS NOT NULL AND ${users.birthMonth} IS NOT NULL AND ${users.birthDay} IS NOT NULL`)
        .groupBy(users.birthYear, users.birthMonth, users.birthDay);
      const ageBands = ageBandCounts(birthGroups.map((g) => ({ birth: { year: g.y as number, month: g.m as number, day: g.d as number }, n: Number(g.n) })), todayInTehran(now));
      const [lastRun] = await db.select().from(botRuns).orderBy(desc(botRuns.startedAt)).limit(1);
      return {
        users: { total: uTotal, newToday: uNew, activeToday: uActive, banned: uBanned },
        ageBands,
        ageUnknown: Math.max(0, uTotal - ageBands.reduce((s, b) => s + b.count, 0)),
        catalog: { products: pTotal, activeProducts: pActive, withoutIcon: pNoIcon, withoutApprovedPrice: pNoPrice, pricesPending: prPending, pricesApproved: prApproved, pricesRejected: prRejected },
        puzzles: nPuzzles,
        economy: { coinsInCirculation: circulation, dailyClaimsToday: claims },
        bot: { candidatesPending: pending, lastRunAt: lastRun?.startedAt.getTime() ?? null, lastRunStatus: lastRun?.status ?? null },
      };
    },
  };
}

