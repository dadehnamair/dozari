import { and, asc, cities, desc, eq, gt, gte, inArray, isNull, like, sql, userStats, users, xpEvents } from '@dozari/db';
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
  /** Admin-written souvenir and slogan; null = the province's souvenir / no slogan. */
  souvenirFa: string | null;
  sloganFa: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** Per-city numbers for the admin city list. */
export interface CityStats {
  players: number;
  /** Players seen in the last 7 days. */
  active7d: number;
  bots: number;
  /** Sum of the players' XP. */
  xp: number;
}

export interface CityPlayerRow {
  id: string;
  nickname: string;
  avatarKey: string;
  isBanned: boolean;
  isBot: boolean;
  xp: number;
  games: number;
  lastSeenAt: number;
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
  updateCity(id: string, patch: { nameFa?: string; isActive?: boolean; sortOrder?: number; province?: string | null; souvenirFa?: string | null; sloganFa?: string | null }): Promise<'ok' | 'not_found'>;
  /** Admin: player / activity / XP totals per city id (cities without players are absent). */
  cityStats(): Promise<Map<string, CityStats>>;
  /** Admin: the players of one city, strongest first. */
  cityPlayers(cityId: string, opts: { q?: string; limit: number; offset: number }): Promise<CityPlayerRow[]>;
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
  const toCity = (r: typeof cities.$inferSelect): CityRow => ({ id: r.id, slug: r.slug, nameFa: r.nameFa, province: r.province, souvenirFa: r.souvenirFa, sloganFa: r.sloganFa, sortOrder: r.sortOrder, isActive: r.isActive });
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
      const row = { id: uuidv7(), slug, nameFa, province, souvenirFa: null, sloganFa: null, sortOrder: Number(top) + 1, isActive: true };
      await db.insert(cities).values(row);
      return row;
    },
    async updateCity(id, patch) {
      const [r] = await db.select({ id: cities.id }).from(cities).where(and(eq(cities.id, id)));
      if (!r) return 'not_found';
      await db.update(cities).set(patch).where(eq(cities.id, id));
      return 'ok';
    },
    async cityStats() {
      const since = new Date(Date.now() - 7 * 86_400_000);
      const rows = await db
        .select({
          cityId: users.cityId,
          players: sql<number>`COUNT(*)`,
          active: sql<number>`SUM(CASE WHEN ${users.lastSeenAt} >= ${since} THEN 1 ELSE 0 END)`,
          bots: sql<number>`SUM(CASE WHEN ${users.isBot} THEN 1 ELSE 0 END)`,
          xp: sql<number>`COALESCE(SUM(${userStats.xp}), 0)`,
        })
        .from(users)
        .leftJoin(userStats, eq(userStats.userId, users.id))
        .where(sql`${users.cityId} IS NOT NULL`)
        .groupBy(users.cityId);
      return new Map(rows.map((r) => [r.cityId as string, { players: Number(r.players), active7d: Number(r.active), bots: Number(r.bots), xp: Number(r.xp) }]));
    },
    async cityPlayers(cityId, opts) {
      const q = opts.q?.trim();
      const pat = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : undefined;
      const rows = await db
        .select({ u: users, xp: userStats.xp, games: userStats.games })
        .from(users)
        .leftJoin(userStats, eq(userStats.userId, users.id))
        .where(and(eq(users.cityId, cityId), pat ? like(users.nickname, pat) : undefined))
        .orderBy(desc(sql`COALESCE(${userStats.xp}, 0)`), asc(users.id))
        .limit(opts.limit)
        .offset(opts.offset);
      return rows.map(({ u, xp, games }) => ({ id: u.id, nickname: u.nickname, avatarKey: u.avatarKey, isBanned: u.isBanned, isBot: u.isBot, xp: xp ?? 0, games: games ?? 0, lastSeenAt: u.lastSeenAt.getTime() }));
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
  const rows: CityRow[] = seedCities.map((c, i) => ({ id: `00000000-0000-7000-8000-${String(i + 1).padStart(12, '0')}`, slug: c.slug, nameFa: c.nameFa, province: c.province ?? null, souvenirFa: null, sloganFa: null, sortOrder: i, isActive: true }));
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
      const row = { id: `00000000-0000-7000-8000-${String(rows.length + 1).padStart(12, '0')}`, slug, nameFa, province, souvenirFa: null, sloganFa: null, sortOrder: rows.length, isActive: true };
      rows.push(row);
      return { ...row };
    },
    async updateCity(id, patch) {
      const r = rows.find((c) => c.id === id);
      if (!r) return 'not_found';
      Object.assign(r, patch);
      return 'ok';
    },
    async cityStats() {
      const out = new Map<string, CityStats>();
      for (const [id, p] of priv) {
        if (!p.cityId) continue;
        const c = out.get(p.cityId) ?? { players: 0, active7d: 0, bots: 0, xp: 0 };
        c.players += 1;
        c.active7d += 1;
        c.xp += stats.get(id)?.xp ?? 0;
        out.set(p.cityId, c);
      }
      return out;
    },
    async cityPlayers(cityId, opts) {
      const q = opts.q?.trim();
      return [...priv.entries()]
        .filter(([id, p]) => p.cityId === cityId && (!q || (nicknames.get(id) ?? '').includes(q)))
        .map(([id]) => ({ id, nickname: nicknames.get(id) ?? '', avatarKey: '', isBanned: false, isBot: false, xp: stats.get(id)?.xp ?? 0, games: stats.get(id)?.games ?? 0, lastSeenAt: now() }))
        .sort((a, b) => b.xp - a.xp || a.id.localeCompare(b.id))
        .slice(opts.offset, opts.offset + opts.limit);
    },
  };
}
