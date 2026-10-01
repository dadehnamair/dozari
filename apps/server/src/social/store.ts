import { and, eq, friendships, or, userBalances, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { Gender } from '@dozari/shared';

export interface PlayerRow {
  id: string;
  nickname: string;
  avatarKey: string;
}

export interface PublicRow extends PlayerRow {
  createdAt: number;
  coins: number;
}

export interface PairState {
  status: 'pending' | 'accepted';
  requestedBy: string;
  /** When the friendship was accepted (ms); null while pending. */
  acceptedAt: number | null;
}

/** I/O boundary of the social features: public profiles, gender and friendships. */
export interface SocialStore {
  publicRow(id: string): Promise<PublicRow | null>;
  getGender(id: string): Promise<Gender | null>;
  setGender(id: string, gender: Gender | null): Promise<void>;
  pair(a: string, b: string): Promise<PairState | null>;
  /** Creates a pending request; false if the pair already has a row. */
  createRequest(from: string, to: string): Promise<boolean>;
  /** Marks a pending pair as accepted; false if there was nothing pending that `by` may accept (it must come from the other side). */
  accept(by: string, other: string, now: number): Promise<boolean>;
  /** Deletes the pair row (cancel, decline or unfriend); false if there was none. */
  remove(a: string, b: string): Promise<boolean>;
  friends(id: string): Promise<PlayerRow[]>;
  incoming(id: string): Promise<PlayerRow[]>;
}

export const sortedPair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export function createDbSocialStore(db: Db): SocialStore {
  const pairWhere = (a: string, b: string) => {
    const [low, high] = sortedPair(a, b);
    return and(eq(friendships.userLow, low), eq(friendships.userHigh, high));
  };
  const rowsOf = async (id: string, wanted: 'accepted' | 'incoming'): Promise<PlayerRow[]> => {
    const rows = await db
      .select()
      .from(friendships)
      .where(and(or(eq(friendships.userLow, id), eq(friendships.userHigh, id)), eq(friendships.status, wanted === 'accepted' ? 'accepted' : 'pending')));
    const others = rows.filter((r) => wanted === 'accepted' || r.requestedBy !== id).map((r) => (r.userLow === id ? r.userHigh : r.userLow));
    const out: PlayerRow[] = [];
    for (const otherId of others) {
      const [u] = await db.select({ id: users.id, nickname: users.nickname, avatarKey: users.avatarKey }).from(users).where(and(eq(users.id, otherId), eq(users.isBanned, false)));
      if (u) out.push(u);
    }
    return out.sort((x, y) => x.nickname.localeCompare(y.nickname, 'fa'));
  };
  return {
    async publicRow(id) {
      const [r] = await db
        .select({ id: users.id, nickname: users.nickname, avatarKey: users.avatarKey, createdAt: users.createdAt, balance: userBalances.balance })
        .from(users)
        .leftJoin(userBalances, eq(userBalances.userId, users.id))
        .where(and(eq(users.id, id), eq(users.isBanned, false)));
      return r ? { id: r.id, nickname: r.nickname, avatarKey: r.avatarKey, createdAt: r.createdAt.getTime(), coins: r.balance ?? 0 } : null;
    },
    async getGender(id) {
      const [r] = await db.select({ gender: users.gender }).from(users).where(eq(users.id, id));
      return r?.gender ?? null;
    },
    async setGender(id, gender) {
      await db.update(users).set({ gender }).where(eq(users.id, id));
    },
    async pair(a, b) {
      const [r] = await db.select().from(friendships).where(pairWhere(a, b));
      return r ? { status: r.status, requestedBy: r.requestedBy, acceptedAt: r.respondedAt ? r.respondedAt.getTime() : null } : null;
    },
    async createRequest(from, to) {
      if (await this.pair(from, to)) return false;
      const [low, high] = sortedPair(from, to);
      try {
        await db.insert(friendships).values({ userLow: low, userHigh: high, requestedBy: from });
      } catch {
        return false; // the other side's request landed first
      }
      return true;
    },
    async accept(by, other, now) {
      const p = await this.pair(by, other);
      if (!p || p.status !== 'pending' || p.requestedBy !== other) return false;
      await db.update(friendships).set({ status: 'accepted', respondedAt: new Date(now) }).where(pairWhere(by, other));
      return true;
    },
    async remove(a, b) {
      if (!(await this.pair(a, b))) return false;
      await db.delete(friendships).where(pairWhere(a, b));
      return true;
    },
    friends: (id) => rowsOf(id, 'accepted'),
    incoming: (id) => rowsOf(id, 'incoming'),
  };
}

/** `seed` is read live, so a test may add players after the store exists. */
export function createMemorySocialStore(seed: PublicRow[]): SocialStore & { genders: Map<string, Gender | null> } {
  const rows = { get: (id: string) => seed.find((r) => r.id === id) };
  const pairs = new Map<string, PairState & { low: string; high: string }>();
  const genders = new Map<string, Gender | null>();
  const key = (a: string, b: string) => sortedPair(a, b).join('|');
  const list = (id: string, wanted: 'accepted' | 'incoming') =>
    [...pairs.values()]
      .filter((p) => (p.low === id || p.high === id) && (wanted === 'accepted' ? p.status === 'accepted' : p.status === 'pending' && p.requestedBy !== id))
      .map((p) => rows.get(p.low === id ? p.high : p.low))
      .filter((r): r is PublicRow => !!r)
      .map((r) => ({ id: r.id, nickname: r.nickname, avatarKey: r.avatarKey }));
  return {
    genders,
    async publicRow(id) {
      return rows.get(id) ?? null;
    },
    async getGender(id) {
      return genders.get(id) ?? null;
    },
    async setGender(id, g) {
      genders.set(id, g);
    },
    async pair(a, b) {
      const p = pairs.get(key(a, b));
      return p ? { status: p.status, requestedBy: p.requestedBy, acceptedAt: p.acceptedAt } : null;
    },
    async createRequest(from, to) {
      if (pairs.has(key(from, to))) return false;
      const [low, high] = sortedPair(from, to);
      pairs.set(key(from, to), { low, high, status: 'pending', requestedBy: from, acceptedAt: null });
      return true;
    },
    async accept(by, other, now) {
      const p = pairs.get(key(by, other));
      if (!p || p.status !== 'pending' || p.requestedBy !== other) return false;
      p.status = 'accepted';
      p.acceptedAt = now;
      return true;
    },
    async remove(a, b) {
      return pairs.delete(key(a, b));
    },
    friends: async (id) => list(id, 'accepted'),
    incoming: async (id) => list(id, 'incoming'),
  };
}
