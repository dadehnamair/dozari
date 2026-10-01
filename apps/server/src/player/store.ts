import { and, asc, cities, eq, sql, userStats, users } from '@dozari/db';
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
  sortOrder: number;
  isActive: boolean;
}

export interface PrivateRow {
  cityId: string | null;
  email: string | null;
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
  cities(opts?: { includeHidden?: boolean }): Promise<CityRow[]>;
  city(id: string): Promise<CityRow | null>;
  addCity(slug: string, nameFa: string): Promise<CityRow | 'duplicate'>;
  updateCity(id: string, patch: { nameFa?: string; isActive?: boolean; sortOrder?: number }): Promise<'ok' | 'not_found'>;
}

export function createDbPlayerStore(db: Db): PlayerStore {
  let seeded = false;
  const ensureCities = async () => {
    if (seeded) return;
    const [any] = await db.select({ id: cities.id }).from(cities).limit(1);
    if (!any) {
      for (const [i, c] of DEFAULT_CITIES.entries()) {
        await db.insert(cities).values({ id: uuidv7(), slug: c.slug, nameFa: c.nameFa, sortOrder: i }).onDuplicateKeyUpdate({ set: { slug: sql`${cities.slug}` } });
      }
    }
    seeded = true;
  };
  const toCity = (r: typeof cities.$inferSelect): CityRow => ({ id: r.id, slug: r.slug, nameFa: r.nameFa, sortOrder: r.sortOrder, isActive: r.isActive });
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
    async addCity(slug, nameFa) {
      await ensureCities();
      const [dup] = await db.select({ id: cities.id }).from(cities).where(eq(cities.slug, slug));
      if (dup) return 'duplicate';
      const [agg] = await db.select({ top: sql<number>`COALESCE(MAX(${cities.sortOrder}), 0)` }).from(cities);
      const top = agg?.top ?? 0;
      const row = { id: uuidv7(), slug, nameFa, sortOrder: Number(top) + 1, isActive: true };
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
export function createMemoryPlayerStore(seedCities: readonly { slug: string; nameFa: string }[] = DEFAULT_CITIES): PlayerStore & { nicknames: Map<string, string> } {
  const stats = new Map<string, StatsRow>();
  const priv = new Map<string, PrivateRow>();
  const nicknames = new Map<string, string>();
  const rows: CityRow[] = seedCities.map((c, i) => ({ id: `00000000-0000-7000-8000-${String(i + 1).padStart(12, '0')}`, slug: c.slug, nameFa: c.nameFa, sortOrder: i, isActive: true }));
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
    async addCity(slug, nameFa) {
      if (rows.some((r) => r.slug === slug)) return 'duplicate';
      const row = { id: `00000000-0000-7000-8000-${String(rows.length + 1).padStart(12, '0')}`, slug, nameFa, sortOrder: rows.length, isActive: true };
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
