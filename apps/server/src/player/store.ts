import { and, asc, cities, desc, eq, gt, inArray, isNull, sql, userStats, users } from '@dozari/db';
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
  addGame(userId: string, outcome: 'win' | 'loss' | 'draw', xp: number): Promise<StatsRow>;
  privateRow(userId: string): Promise<PrivateRow>;
  setCity(userId: string, cityId: string | null): Promise<void>;
  setEmail(userId: string, email: string | null): Promise<void>;
  setNickname(userId: string, nickname: string): Promise<void>;
  /** The top `limit` players by XP inside a filter (`cityId`, or an explicit id list); ties break by id for a stable order. */
  ranking(filter: RankFilter, limit: number): Promise<{ userId: string; xp: number }[]>;
  /** 1-based place of a player inside the filter (players with more XP + 1). */
  rankOf(userId: string, filter: RankFilter): Promise<number>;
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
    async addGame(userId, outcome, xp) {
      const inc = { xp: sql`${userStats.xp} + ${xp}`, games: sql`${userStats.games} + 1`, wins: sql`${userStats.wins} + ${outcome === 'win' ? 1 : 0}`, losses: sql`${userStats.losses} + ${outcome === 'loss' ? 1 : 0}`, draws: sql`${userStats.draws} + ${outcome === 'draw' ? 1 : 0}`, updatedAt: new Date() };
      await db
        .insert(userStats)
        .values({ userId, xp, games: 1, wins: outcome === 'win' ? 1 : 0, losses: outcome === 'loss' ? 1 : 0, draws: outcome === 'draw' ? 1 : 0 })
        .onDuplicateKeyUpdate({ set: inc });
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
    async ranking(filter, limit) {
      const where = and(...rankWhere(filter));
      const rows = await db
        .select({ userId: userStats.userId, xp: userStats.xp })
        .from(userStats)
        .innerJoin(users, eq(users.id, userStats.userId))
        .where(where)
        .orderBy(desc(userStats.xp), asc(userStats.userId))
        .limit(limit);
      return rows;
    },
    async rankOf(userId, filter) {
      const [mine] = await db.select({ xp: userStats.xp }).from(userStats).where(eq(userStats.userId, userId));
      const xp = mine?.xp ?? 0;
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
export function createMemoryPlayerStore(seedCities: readonly { slug: string; nameFa: string; province?: string | null }[] = DEFAULT_CITIES): PlayerStore & { nicknames: Map<string, string> } {
  const stats = new Map<string, StatsRow>();
  const priv = new Map<string, PrivateRow>();
  const nicknames = new Map<string, string>();
  const inFilter = (f: RankFilter) =>
    [...stats.entries()]
      .map(([userId, s]) => ({ userId, xp: s.xp }))
      .filter((r) => (f.cityId ? priv.get(r.userId)?.cityId === f.cityId : true) && (f.userIds ? f.userIds.includes(r.userId) : true));
  const rows: CityRow[] = seedCities.map((c, i) => ({ id: `00000000-0000-7000-8000-${String(i + 1).padStart(12, '0')}`, slug: c.slug, nameFa: c.nameFa, province: c.province ?? null, sortOrder: i, isActive: true }));
  return {
    nicknames,
    async stats(id) {
      return { ...(stats.get(id) ?? EMPTY_STATS) };
    },
    async addGame(id, outcome, xp) {
      const s = { ...(stats.get(id) ?? EMPTY_STATS) };
      s.xp += xp;
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
    async ranking(filter, limit) {
      return inFilter(filter)
        .sort((a, b) => b.xp - a.xp || a.userId.localeCompare(b.userId))
        .slice(0, limit);
    },
    async rankOf(id, filter) {
      const xp = stats.get(id)?.xp ?? 0;
      return inFilter(filter).filter((r) => r.xp > xp).length + 1;
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
