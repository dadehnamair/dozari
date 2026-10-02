import { and, asc, cities, desc, eq, gt, gte, inArray, isNull, sql, userStats, users, xpEvents } from '@dozari/db';
import type { Db } from '@dozari/db';
import { DEFAULT_CITIES } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';

export interface StatsRow {
  xp: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface CityRow {
  id: string;
  slug: string;
  nameFa: string;
  /** Key into shared `PROVINCES`; null = no regional identity. */
  province: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface PrivateRow {
  cityId: string | null;
  email: string | null;
}

/** Who takes part in a ranking: everyone, one city, or an explicit list of players. */
export interface RankFilter {
  cityId?: string;
  userIds?: readonly string[];
}

export const EMPTY_STATS: StatsRow = { xp: 0, games: 0, wins: 0, losses: 0, draws: 0 };

/** I/O boundary of the player record: stats, city, e-mail, nickname. */
export interface PlayerStore {
  stats(userId: string): Promise<StatsRow>;
  /** Adds one finished game and its XP; returns the new totals. */
  addGame(userId: string, outcome: 'win' | 'loss' | 'draw', xp: number, mode?: 'solo' | 'duel'): Promise<StatsRow>;
  /** The last `limit` finished games, newest first. */
  recentGames(userId: string, limit: number): Promise<{ mode: 'solo' | 'duel' | null; outcome: 'win' | 'loss' | 'draw' | null; xp: number; at: number }[]>;
  privateRow(userId: string): Promise<PrivateRow>;
  setCity(userId: string, cityId: string | null): Promise<void>;
  setEmail(userId: string, email: string | null): Promise<void>;
  setNickname(userId: string, nickname: string): Promise<void>;
  /** The top `limit` players by XP inside a filter (`cityId`, or an explicit id list); ties break by id for a stable order. With `since` only the XP earned from that time counts (players with none are left out). */
  ranking(filter: RankFilter, limit: number, since?: number): Promise<{ userId: string; xp: number }[]>;
  /** 1-based place of a player inside the filter (players with more XP + 1). */
  rankOf(userId: string, filter: RankFilter, since?: number): Promise<number>;
  /** XP a player earned since `since` (epoch ms); the total when omitted. */
  xpSince(userId: string, since?: number): Promise<number>;
  cities(opts?: { includeHidden?: boolean }): Promise<CityRow[]>;
  city(id: string): Promise<CityRow | null>;
  addCity(slug: string, nameFa: string, province?: string | null): Promise<CityRow | 'duplicate'>;
  updateCity(id: string, patch: { nameFa?: string; isActive?: boolean; sortOrder?: number; province?: string | null }): Promise<'ok' | 'not_found'>;
}

export function createDbPlayerStore(db: Db): PlayerStore {
  let seeded = false;
  /**
   * Adds the default cities an older table lacks (abroad cities came later) and fills a missing province from the
   * defaults; rows the admin renamed, hid, reordered or gave a province keep those changes.
   */
  const ensureCities = async () => {
    if (seeded) return;
    const have = new Map((await db.select({ slug: cities.slug, province: cities.province }).from(cities)).map((r) => [r.slug, r.province]));
    for (const [i, c] of DEFAULT_CITIES.entries()) {
      if (!have.has(c.slug)) await db.insert(cities).values({ id: uuidv7(), slug: c.slug, nameFa: c.nameFa, province: c.province, sortOrder: i }).onDuplicateKeyUpdate({ set: { slug: sql`${cities.slug}` } });
      else if (have.get(c.slug) === null && c.province) await db.update(cities).set({ province: c.province }).where(and(eq(cities.slug, c.slug), isNull(cities.province)));
    }
    seeded = true;
  };
  const rankWhere = (f: RankFilter) => [f.cityId ? eq(users.cityId, f.cityId) : undefined, f.userIds ? (f.userIds.length > 0 ? inArray(users.id, [...f.userIds]) : sql`1 = 0`) : undefined];
  const toCity = (r: typeof cities.$inferSelect): CityRow => ({ id: r.id, slug: r.slug, nameFa: r.nameFa, province: r.province, sortOrder: r.sortOrder, isActive: r.isActive });
  return {
    async stats(userId) {
      const [r] = await db.select().from(userStats).where(eq(userStats.userId, userId));
      return r ? { xp: r.xp, games: r.games, wins: r.wins, losses: r.losses, draws: r.draws } : { ...EMPTY_STATS };
    },
    async addGame(userId, outcome, xp, mode) {
      const inc = { xp: sql`${userStats.xp} + ${xp}`, games: sql`${userStats.games} + 1`, wins: sql`${userStats.wins} + ${outcome === 'win' ? 1 : 0}`, losses: sql`${userStats.losses} + ${outcome === 'loss' ? 1 : 0}`, draws: sql`${userStats.draws} + ${outcome === 'draw' ? 1 : 0}`, updatedAt: new Date() };
      await db
        .insert(userStats)
        .values({ userId, xp, games: 1, wins: outcome === 'win' ? 1 : 0, losses: outcome === 'loss' ? 1 : 0, draws: outcome === 'draw' ? 1 : 0 })
        .onDuplicateKeyUpdate({ set: inc });
      await db.insert(xpEvents).values({ id: uuidv7(), userId, xp, mode: mode ?? null, outcome });
      return this.stats(userId);
    },
    async privateRow(userId) {
      const [r] = await db.select({ cityId: users.cityId, email: users.email }).from(users).where(eq(users.id, userId));
      return r ?? { cityId: null, email: null };
    },
    async setCity(userId, cityId) {
      await db.update(users).set({ cityId }).where(eq(users.id, userId));
    },
    async setEmail(userId, email) {
      await db.update(users).set({ email }).where(eq(users.id, userId));
    },
    async setNickname(userId, nickname) {
      await db.update(users).set({ nickname }).where(eq(users.id, userId));
    },
    async ranking(filter, limit, since) {
      const where = and(...rankWhere(filter));
      if (since !== undefined) {
        const sum = sql<number>`SUM(${xpEvents.xp})`;
        const rows = await db
          .select({ userId: xpEvents.userId, xp: sum })
          .from(xpEvents)
          .innerJoin(users, eq(users.id, xpEvents.userId))
          .where(and(where, gte(xpEvents.createdAt, new Date(since))))
          .groupBy(xpEvents.userId)
          .orderBy(desc(sum), asc(xpEvents.userId))
          .limit(limit);
        return rows.map((r) => ({ userId: r.userId, xp: Number(r.xp) }));
      }
      const rows = await db
        .select({ userId: userStats.userId, xp: userStats.xp })
        .from(userStats)
        .innerJoin(users, eq(users.id, userStats.userId))
        .where(where)
        .orderBy(desc(userStats.xp), asc(userStats.userId))
        .limit(limit);
      return rows;
    },
    async recentGames(userId, limit) {
      const rows = await db.select({ mode: xpEvents.mode, outcome: xpEvents.outcome, xp: xpEvents.xp, at: xpEvents.createdAt }).from(xpEvents).where(eq(xpEvents.userId, userId)).orderBy(desc(xpEvents.createdAt), desc(xpEvents.id)).limit(limit);
      return rows.map((r) => ({ mode: r.mode, outcome: r.outcome, xp: r.xp, at: r.at.getTime() }));
    },
    async xpSince(userId, since) {
      if (since === undefined) {
        const [r] = await db.select({ xp: userStats.xp }).from(userStats).where(eq(userStats.userId, userId));
        return r?.xp ?? 0;
      }
      const [r] = await db.select({ xp: sql<number>`COALESCE(SUM(${xpEvents.xp}), 0)` }).from(xpEvents).where(and(eq(xpEvents.userId, userId), gte(xpEvents.createdAt, new Date(since))));
      return Number(r?.xp ?? 0);
    },
    async rankOf(userId, filter, since) {
      const xp = await this.xpSince(userId, since);
      if (since !== undefined) {
        const sum = sql<number>`SUM(${xpEvents.xp})`;
        const above = await db
          .select({ userId: xpEvents.userId })
          .from(xpEvents)
          .innerJoin(users, eq(users.id, xpEvents.userId))
          .where(and(...rankWhere(filter), gte(xpEvents.createdAt, new Date(since))))
          .groupBy(xpEvents.userId)
          .having(sql`${sum} > ${xp}`);
        return above.length + 1;
      }
      const [agg] = await db
        .select({ above: sql<number>`COUNT(*)` })
        .from(userStats)
        .innerJoin(users, eq(users.id, userStats.userId))
        .where(and(...rankWhere(filter), gt(userStats.xp, xp)));
      return Number(agg?.above ?? 0) + 1;
    },
    async cities(opts) {
      await ensureCities();
      const rows = await db.select().from(cities).where(opts?.includeHidden ? undefined : eq(cities.isActive, true)).orderBy(asc(cities.sortOrder), asc(cities.nameFa));
      return rows.map(toCity);
    },
    async city(id) {
      await ensureCities();
      const [r] = await db.select().from(cities).where(eq(cities.id, id));
      return r ? toCity(r) : null;
    },
    async addCity(slug, nameFa, province = null) {
      await ensureCities();
      const [dup] = await db.select({ id: cities.id }).from(cities).where(eq(cities.slug, slug));
      if (dup) return 'duplicate';
      const [agg] = await db.select({ top: sql<number>`COALESCE(MAX(${cities.sortOrder}), 0)` }).from(cities);
      const top = agg?.top ?? 0;
      const row = { id: uuidv7(), slug, nameFa, province, sortOrder: Number(top) + 1, isActive: true };
      await db.insert(cities).values(row);
      return row;
    },
    async updateCity(id, patch) {
      const [r] = await db.select({ id: cities.id }).from(cities).where(and(eq(cities.id, id)));
      if (!r) return 'not_found';
      await db.update(cities).set(patch).where(eq(cities.id, id));
      return 'ok';
    },
  };
}

/** Memory store for tests; `seedCities` mirrors the default list when omitted. */
export function createMemoryPlayerStore(seedCities: readonly { slug: string; nameFa: string; province?: string | null }[] = DEFAULT_CITIES, now: () => number = Date.now): PlayerStore & { nicknames: Map<string, string> } {
  const stats = new Map<string, StatsRow>();
  const events: { userId: string; xp: number; at: number; mode: 'solo' | 'duel' | null; outcome: 'win' | 'loss' | 'draw' | null }[] = [];
  const priv = new Map<string, PrivateRow>();
  const nicknames = new Map<string, string>();
  const xpOf = (userId: string, since?: number) => (since === undefined ? (stats.get(userId)?.xp ?? 0) : events.filter((e) => e.userId === userId && e.at >= since).reduce((a, e) => a + e.xp, 0));
  const inFilter = (f: RankFilter, since?: number) =>
    [...stats.keys()]
      .map((userId) => ({ userId, xp: xpOf(userId, since) }))
      .filter((r) => since === undefined || r.xp > 0)
      .filter((r) => (f.cityId ? priv.get(r.userId)?.cityId === f.cityId : true) && (f.userIds ? f.userIds.includes(r.userId) : true));
  const rows: CityRow[] = seedCities.map((c, i) => ({ id: `00000000-0000-7000-8000-${String(i + 1).padStart(12, '0')}`, slug: c.slug, nameFa: c.nameFa, province: c.province ?? null, sortOrder: i, isActive: true }));
  return {
    nicknames,
    async stats(id) {
      return { ...(stats.get(id) ?? EMPTY_STATS) };
    },
    async addGame(id, outcome, xp, mode) {
      const s = { ...(stats.get(id) ?? EMPTY_STATS) };
      s.xp += xp;
      events.push({ userId: id, xp, at: now(), mode: mode ?? null, outcome });
      s.games += 1;
      if (outcome === 'win') s.wins += 1;
      if (outcome === 'loss') s.losses += 1;
      if (outcome === 'draw') s.draws += 1;
      stats.set(id, s);
      return { ...s };
    },
    async privateRow(id) {
      return { ...(priv.get(id) ?? { cityId: null, email: null }) };
    },
    async recentGames(id, limit) {
      return events.filter((e) => e.userId === id).sort((a, b) => b.at - a.at).slice(0, limit).map((e) => ({ mode: e.mode, outcome: e.outcome, xp: e.xp, at: e.at }));
    },
    async ranking(filter, limit, since) {
      return inFilter(filter, since)
        .sort((a, b) => b.xp - a.xp || a.userId.localeCompare(b.userId))
        .slice(0, limit);
    },
    async xpSince(id, since) {
      return xpOf(id, since);
    },
    async rankOf(id, filter, since) {
      const xp = xpOf(id, since);
      return inFilter(filter, since).filter((r) => r.xp > xp).length + 1;
    },
    async setCity(id, cityId) {
      priv.set(id, { ...(priv.get(id) ?? { cityId: null, email: null }), cityId });
    },
    async setEmail(id, email) {
      priv.set(id, { ...(priv.get(id) ?? { cityId: null, email: null }), email });
    },
    async setNickname(id, nickname) {
      nicknames.set(id, nickname);
    },
    async cities(opts) {
      return rows.filter((r) => opts?.includeHidden || r.isActive).map((r) => ({ ...r }));
    },
    async city(id) {
      const r = rows.find((c) => c.id === id);
      return r ? { ...r } : null;
    },
    async addCity(slug, nameFa, province = null) {
      if (rows.some((r) => r.slug === slug)) return 'duplicate';
      const row = { id: `00000000-0000-7000-8000-${String(rows.length + 1).padStart(12, '0')}`, slug, nameFa, province, sortOrder: rows.length, isActive: true };
      rows.push(row);
      return { ...row };
    },
    async updateCity(id, patch) {
      const r = rows.find((c) => c.id === id);
      if (!r) return 'not_found';
      Object.assign(r, patch);
      return 'ok';
    },
  };
}
