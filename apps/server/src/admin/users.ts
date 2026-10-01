import { coinLedger, desc, eq, like, or, userBalances, users } from '@dozari/db';
import type { Db } from '@dozari/db';
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

export interface UsersAdmin {
  list(query: string, limit: number): Promise<AdminUserRow[]>;
  ledger(userId: string, limit: number): Promise<LedgerRow[]>;
  setBanned(userId: string, banned: boolean): Promise<'ok' | 'not_found'>;
  /** Signed coins through the ledger (`admin_adjust`); refused when the balance would go negative. */
  adjustCoins(userId: string, delta: number): Promise<{ balance: number } | 'not_found' | 'insufficient'>;
}

export function createDbUsersAdmin(db: Db): UsersAdmin {
  return {
    async list(query, limit) {
      const q = query.trim();
      const rows = await db
        .select({ u: users, balance: userBalances.balance })
        .from(users)
        .leftJoin(userBalances, eq(userBalances.userId, users.id))
        .where(q ? or(like(users.nickname, `%${q}%`), eq(users.id, q)) : undefined)
        .orderBy(desc(users.lastSeenAt))
        .limit(limit);
      return rows.map(({ u, balance }) => ({
        id: u.id,
        nickname: u.nickname,
        avatarKey: u.avatarKey,
        isBanned: u.isBanned,
        balance: balance ?? 0,
        createdAt: u.createdAt.getTime(),
        lastSeenAt: u.lastSeenAt.getTime(),
      }));
    },
    async ledger(userId, limit) {
      const rows = await db.select().from(coinLedger).where(eq(coinLedger.userId, userId)).orderBy(desc(coinLedger.createdAt)).limit(limit);
      return rows.map((r) => ({ id: r.id, delta: r.delta, reason: r.reason, at: r.createdAt.getTime() }));
    },
    async setBanned(userId, banned) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
      if (!u) return 'not_found';
      await db.update(users).set({ isBanned: banned }).where(eq(users.id, userId));
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

