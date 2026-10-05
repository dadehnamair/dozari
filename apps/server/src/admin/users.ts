import { and, baleLinks, cities, coinLedger, count, desc, eq, friendships, like, or, shopItems, shopPurchases, userBalances, userClients, userCosmetics, userGems, userInventory, userNotes, userStats, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import { AVATAR_KEYS, ageOn, randomGuestIdentity, todayInTehran } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';
import { applyGemEntry } from '../economy/gems.js';
import { applyLedgerEntry } from '../economy/ledger.js';

export interface AdminUserRow {
  id: string;
  nickname: string;
  avatarKey: string;
  isBanned: boolean;
  balance: number;
  /** Chosen age track (D198). */
  ageTrack: 'kid' | 'teen' | 'adult';
  createdAt: number;
  lastSeenAt: number;
}

export interface LedgerRow {
  id: string;
  delta: number;
  reason: string;
  at: number;
}

export interface UserListOptions {
  filter?: 'all' | 'banned' | 'new';
  sort?: 'lastSeen' | 'created' | 'coins';
  offset?: number;
  /** Only players of this age track (D198). */
  track?: 'kid' | 'teen' | 'adult';
  /** Also match the query against phone, handle and e-mail (only for roles that may see contact details). */
  contact?: boolean;
}

export interface UserDetail extends AdminUserRow {
  gender: string | null;
  banReason: string | null;
  bannedAt: number | null;
  friends: number;
  /** Whole years from the player's own optional birth date; null when none. */
  age: number | null;
  /** The exact Solar Hijri date: only the owner role may see it (the route removes it for other roles). */
  birth: { year: number; month: number; day: number } | null;
  baleLinked: boolean;
  /** Everything else about the account (the route hides the private contact fields from roles without `users`). */
  account: {
    handle: string | null;
    phone: string | null;
    phoneVerifiedAt: number | null;
    email: string | null;
    deviceId: string | null;
    isBot: boolean;
    showAge: boolean;
    findableByPhone: boolean;
    notifyBirthday: boolean;
    chatUnlockedAt: number | null;
    ageTrackSetAt: number | null;
    city: string | null;
    baleLinkedAt: number | null;
    gems: number;
    stats: { xp: number; games: number; wins: number; losses: number; draws: number };
    inventory: { effect: string; qty: number }[];
    cosmetics: { titleFa: string; slot: string | null; equipped: boolean; source: string; at: number }[];
    /** The app the player used last and where it was first seen (install source); null before the first report. */
    client: { platform: string; osVersion: string | null; appBuild: number | null; store: string | null; firstStore: string | null; firstBuild: number | null; firstSeenAt: number; updatedAt: number } | null;
    purchases: { titleFa: string; priceCoins: number; priceGems: number; at: number }[];
  };
  notes: { id: string; note: string; at: number }[];
}

export interface UsersAdmin {
  list(query: string, limit: number, opts?: UserListOptions): Promise<AdminUserRow[]>;
  detail(userId: string): Promise<UserDetail | null>;
  ledger(userId: string, limit: number): Promise<LedgerRow[]>;
  /** Bans (with an optional reason) or unbans; a ban also ends every session of the player. */
  setBanned(userId: string, banned: boolean, reason?: string | null): Promise<'ok' | 'not_found'>;
  /** Ends every session of the player: tokens issued before now stop working. */
  logoutEverywhere(userId: string): Promise<'ok' | 'not_found'>;
  /** Moderation: set a new nickname / avatar, or (no argument) draw a fresh random identity. */
  setIdentity(userId: string, identity?: { nickname?: string; avatarKey?: string }): Promise<'ok' | 'not_found' | 'invalid'>;
  addNote(userId: string, note: string): Promise<{ id: string } | 'not_found'>;
  removeNote(noteId: string): Promise<'ok' | 'not_found'>;
  /** Signed coins through the ledger (`admin_adjust`); refused when the balance would go negative. */
  adjustCoins(userId: string, delta: number): Promise<{ balance: number } | 'not_found' | 'insufficient'>;
  /** Signed gems through the gem ledger (`admin_adjust`, D164); refused when the balance would go negative. */
  adjustGems(userId: string, delta: number): Promise<{ balance: number } | 'not_found' | 'insufficient'>;
}

function rowOf(u: typeof users.$inferSelect, balance: number | null): AdminUserRow {
  return { id: u.id, nickname: u.nickname, avatarKey: u.avatarKey, isBanned: u.isBanned, balance: balance ?? 0, ageTrack: u.ageTrack, createdAt: u.createdAt.getTime(), lastSeenAt: u.lastSeenAt.getTime() };
}

export function createDbUsersAdmin(db: Db): UsersAdmin {
  return {
    async list(query, limit, opts = {}) {
      const q = query.trim();
      const pat = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const search = q ? (opts.contact ? or(like(users.nickname, pat), eq(users.id, q), like(users.phone, pat), like(users.handle, pat), like(users.email, pat)) : or(like(users.nickname, pat), eq(users.id, q))) : undefined;
      const filter = opts.filter === 'banned' ? eq(users.isBanned, true) : undefined;
      const track = opts.track ? eq(users.ageTrack, opts.track) : undefined;
      const order = opts.sort === 'coins' ? desc(userBalances.balance) : opts.sort === 'created' || opts.filter === 'new' ? desc(users.createdAt) : desc(users.lastSeenAt);
      const rows = await db
        .select({ u: users, balance: userBalances.balance })
        .from(users)
        .leftJoin(userBalances, eq(userBalances.userId, users.id))
        .where(and(search, filter, track))
        .orderBy(order)
        .limit(limit)
        .offset(opts.offset ?? 0);
      return rows.map(({ u, balance }) => rowOf(u, balance));
    },
    async detail(userId) {
      const [r] = await db.select({ u: users, balance: userBalances.balance }).from(users).leftJoin(userBalances, eq(userBalances.userId, users.id)).where(eq(users.id, userId));
      if (!r) return null;
      const [[f], link, notes, [gem], [st], inv, cos, buys, [cl], city] = await Promise.all([
        db.select({ n: count() }).from(friendships).where(and(or(eq(friendships.userLow, userId), eq(friendships.userHigh, userId)), eq(friendships.status, 'accepted'))),
        db.select({ id: baleLinks.userId, at: baleLinks.linkedAt }).from(baleLinks).where(eq(baleLinks.userId, userId)),
        db.select().from(userNotes).where(eq(userNotes.userId, userId)).orderBy(desc(userNotes.createdAt)).limit(50),
        db.select({ balance: userGems.balance }).from(userGems).where(eq(userGems.userId, userId)),
        db.select().from(userStats).where(eq(userStats.userId, userId)),
        db.select().from(userInventory).where(eq(userInventory.userId, userId)),
        db.select({ c: userCosmetics, t: shopItems.titleFa, slot: shopItems.slot }).from(userCosmetics).innerJoin(shopItems, eq(shopItems.id, userCosmetics.itemId)).where(eq(userCosmetics.userId, userId)).orderBy(desc(userCosmetics.acquiredAt)).limit(50),
        db.select({ p: shopPurchases, t: shopItems.titleFa }).from(shopPurchases).leftJoin(shopItems, eq(shopItems.id, shopPurchases.itemId)).where(eq(shopPurchases.userId, userId)).orderBy(desc(shopPurchases.createdAt)).limit(15),
        db.select().from(userClients).where(eq(userClients.userId, userId)),
        r.u.cityId ? db.select({ n: cities.nameFa }).from(cities).where(eq(cities.id, r.u.cityId)) : Promise.resolve([] as { n: string }[]),
      ]);
      return {
        ...rowOf(r.u, r.balance),
        gender: r.u.gender,
        banReason: r.u.banReason,
        bannedAt: r.u.bannedAt?.getTime() ?? null,
        friends: f?.n ?? 0,
        ...(() => {
          const { birthYear: y, birthMonth: m, birthDay: d } = r.u;
          if (y == null || m == null || d == null) return { age: null, birth: null };
          return { age: ageOn({ year: y, month: m, day: d }, todayInTehran(Date.now())), birth: { year: y, month: m, day: d } };
        })(),
        baleLinked: link.length > 0,
        account: {
          handle: r.u.handle,
          phone: r.u.phone,
          phoneVerifiedAt: r.u.phoneVerifiedAt?.getTime() ?? null,
          email: r.u.email,
          deviceId: r.u.deviceId,
          isBot: r.u.isBot,
          showAge: r.u.showAge,
          findableByPhone: r.u.findableByPhone,
          notifyBirthday: r.u.notifyBirthday,
          chatUnlockedAt: r.u.chatUnlockedAt?.getTime() ?? null,
          ageTrackSetAt: r.u.ageTrackSetAt?.getTime() ?? null,
          city: city[0]?.n ?? null,
          baleLinkedAt: link[0]?.at.getTime() ?? null,
          gems: gem?.balance ?? 0,
          stats: { xp: st?.xp ?? 0, games: st?.games ?? 0, wins: st?.wins ?? 0, losses: st?.losses ?? 0, draws: st?.draws ?? 0 },
          inventory: inv.map((i) => ({ effect: i.effect, qty: i.qty })),
          cosmetics: cos.map((x) => ({ titleFa: x.t, slot: x.slot, equipped: x.c.equipped, source: x.c.source, at: x.c.acquiredAt.getTime() })),
          client: cl ? { platform: cl.platform, osVersion: cl.osVersion, appBuild: cl.appBuild, store: cl.store, firstStore: cl.firstStore, firstBuild: cl.firstBuild, firstSeenAt: cl.firstSeenAt.getTime(), updatedAt: cl.updatedAt.getTime() } : null,
          purchases: buys.map((x) => ({ titleFa: x.t ?? '—', priceCoins: x.p.priceCoins, priceGems: x.p.priceGems, at: x.p.createdAt.getTime() })),
        },
        notes: notes.map((n) => ({ id: n.id, note: n.note, at: n.createdAt.getTime() })),
      };
    },
    async ledger(userId, limit) {
      const rows = await db.select().from(coinLedger).where(eq(coinLedger.userId, userId)).orderBy(desc(coinLedger.createdAt)).limit(limit);
      return rows.map((r) => ({ id: r.id, delta: r.delta, reason: r.reason, at: r.createdAt.getTime() }));
    },
    async setBanned(userId, banned, reason) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
      if (!u) return 'not_found';
      const now = new Date();
      await db
        .update(users)
        .set(banned ? { isBanned: true, banReason: reason?.slice(0, 200) ?? null, bannedAt: now, sessionsValidAfter: now } : { isBanned: false, banReason: null, bannedAt: null })
        .where(eq(users.id, userId));
      return 'ok';
    },
    async logoutEverywhere(userId) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
      if (!u) return 'not_found';
      await db.update(users).set({ sessionsValidAfter: new Date() }).where(eq(users.id, userId));
      return 'ok';
    },
    async setIdentity(userId, identity) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
      if (!u) return 'not_found';
      const next = identity ?? randomGuestIdentity(Math.random);
      const nickname = next.nickname?.trim();
      if (nickname !== undefined && (nickname.length < 2 || nickname.length > 30)) return 'invalid';
      if (next.avatarKey !== undefined && !AVATAR_KEYS.includes(next.avatarKey)) return 'invalid';
      const set = { ...(nickname !== undefined ? { nickname } : {}), ...(next.avatarKey !== undefined ? { avatarKey: next.avatarKey } : {}) };
      if (Object.keys(set).length === 0) return 'invalid';
      await db.update(users).set(set).where(eq(users.id, userId));
      return 'ok';
    },
    async addNote(userId, note) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
      if (!u) return 'not_found';
      const id = uuidv7();
      await db.insert(userNotes).values({ id, userId, note: note.slice(0, 500) });
      return { id };
    },
    async removeNote(noteId) {
      const [n] = await db.select({ id: userNotes.id }).from(userNotes).where(eq(userNotes.id, noteId));
      if (!n) return 'not_found';
      await db.delete(userNotes).where(eq(userNotes.id, noteId));
      return 'ok';
    },
    async adjustCoins(userId, delta) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
      if (!u) return 'not_found';
      const out = await db.transaction((tx) =>
        applyLedgerEntry(tx, { userId, delta, reason: 'admin_adjust', refType: 'admin', refId: uuidv7(), idempotencyKey: `admin_adjust:${uuidv7()}:${userId}` }),
      );
      return out.applied ? { balance: out.balance } : 'insufficient';
    },
    async adjustGems(userId, delta) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
      if (!u) return 'not_found';
      const out = await db.transaction((tx) => applyGemEntry(tx, { userId, delta, reason: 'admin_adjust', refType: 'admin', refId: uuidv7(), idempotencyKey: `admin_adjust:${uuidv7()}:${userId}` }));
      return out.applied ? { balance: out.balance } : 'insufficient';
    },
  };
}

