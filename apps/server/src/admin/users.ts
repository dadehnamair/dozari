import { and, baleLinks, coinLedger, count, desc, eq, friendships, like, or, userBalances, userNotes, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import { AVATAR_KEYS, randomGuestIdentity } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';
import { applyLedgerEntry } from '../economy/ledger.js';

export interface AdminUserRow {
  id: string;
  nickname: string;
  avatarKey: string;
  isBanned: boolean;
  balance: number;
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
}

export interface UserDetail extends AdminUserRow {
  gender: string | null;
  banReason: string | null;
  bannedAt: number | null;
  friends: number;
  baleLinked: boolean;
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
}

function rowOf(u: typeof users.$inferSelect, balance: number | null): AdminUserRow {
  return { id: u.id, nickname: u.nickname, avatarKey: u.avatarKey, isBanned: u.isBanned, balance: balance ?? 0, createdAt: u.createdAt.getTime(), lastSeenAt: u.lastSeenAt.getTime() };
}

export function createDbUsersAdmin(db: Db): UsersAdmin {
  return {
    async list(query, limit, opts = {}) {
      const q = query.trim();
      const search = q ? or(like(users.nickname, `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`), eq(users.id, q)) : undefined;
      const filter = opts.filter === 'banned' ? eq(users.isBanned, true) : undefined;
      const order = opts.sort === 'coins' ? desc(userBalances.balance) : opts.sort === 'created' || opts.filter === 'new' ? desc(users.createdAt) : desc(users.lastSeenAt);
      const rows = await db
        .select({ u: users, balance: userBalances.balance })
        .from(users)
        .leftJoin(userBalances, eq(userBalances.userId, users.id))
        .where(and(search, filter))
        .orderBy(order)
        .limit(limit)
        .offset(opts.offset ?? 0);
      return rows.map(({ u, balance }) => rowOf(u, balance));
    },
    async detail(userId) {
      const [r] = await db.select({ u: users, balance: userBalances.balance }).from(users).leftJoin(userBalances, eq(userBalances.userId, users.id)).where(eq(users.id, userId));
      if (!r) return null;
      const [[f], link, notes] = await Promise.all([
        db.select({ n: count() }).from(friendships).where(and(or(eq(friendships.userLow, userId), eq(friendships.userHigh, userId)), eq(friendships.status, 'accepted'))),
        db.select({ id: baleLinks.userId }).from(baleLinks).where(eq(baleLinks.userId, userId)),
        db.select().from(userNotes).where(eq(userNotes.userId, userId)).orderBy(desc(userNotes.createdAt)).limit(50),
      ]);
      return {
        ...rowOf(r.u, r.balance),
        gender: r.u.gender,
        banReason: r.u.banReason,
        bannedAt: r.u.bannedAt?.getTime() ?? null,
        friends: f?.n ?? 0,
        baleLinked: link.length > 0,
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
  };
}

