import { and, asc, eq, userAvatars, userBalances, userStats, users, avatarCatalog } from '@dozari/db';
import type { Db } from '@dozari/db';
import { CHARACTER_AVATAR_KEYS, defaultAvatarPrice } from '@dozari/shared';
import { applyLedgerEntry } from '../economy/ledger.js';

export interface AvatarRow {
  avatarKey: string;
  priceCoins: number;
  sortOrder: number;
  isActive: boolean;
}

export interface AvatarFacts {
  avatarKey: string;
  balance: number;
  games: number;
  inviteRedeemed: boolean;
  /** Keys of the paid avatars this player bought. */
  bought: Set<string>;
}

export type AvatarChange = 'ok' | 'insufficient' | 'unknown';

/** Persistence of the avatar shelf: prices (admin-edited), what a player bought, and the change itself. */
export interface AvatarStore {
  catalog(opts?: { includeHidden?: boolean }): Promise<AvatarRow[]>;
  updateAvatar(key: string, patch: { priceCoins?: number; isActive?: boolean }): Promise<'ok' | 'not_found'>;
  facts(userId: string): Promise<AvatarFacts>;
    /** Pays `price` coins through the ledger, records the purchase and wears the avatar, all in one transaction. */
  buy(userId: string, key: string, price: number): Promise<AvatarChange>;
}

export function createDbAvatarStore(db: Db): AvatarStore {
  let seeded = false;
  const seed = async () => {
    if (seeded) return;
    // Missing keys get their opening price (the first ones free); rows that exist keep what the admin set.
    const have = new Set((await db.select({ k: avatarCatalog.avatarKey }).from(avatarCatalog)).map((r) => r.k));
    const missing = CHARACTER_AVATAR_KEYS.map((avatarKey, i) => ({ avatarKey, priceCoins: defaultAvatarPrice(i), sortOrder: i })).filter((r) => !have.has(r.avatarKey));
    if (missing.length > 0) await db.insert(avatarCatalog).ignore().values(missing);
    seeded = true;
  };
  return {
    async catalog(opts) {
      await seed();
      const rows = await db.select().from(avatarCatalog).where(opts?.includeHidden ? undefined : eq(avatarCatalog.isActive, true)).orderBy(asc(avatarCatalog.sortOrder));
      return rows;
    },
    async updateAvatar(key, patch) {
      await seed();
      const [r] = await db.select({ k: avatarCatalog.avatarKey }).from(avatarCatalog).where(eq(avatarCatalog.avatarKey, key));
      if (!r) return 'not_found';
      if (Object.keys(patch).length > 0) await db.update(avatarCatalog).set(patch).where(eq(avatarCatalog.avatarKey, key));
      return 'ok';
    },
    async facts(userId) {
      const [u] = await db.select({ avatarKey: users.avatarKey, chatUnlockedAt: users.chatUnlockedAt }).from(users).where(eq(users.id, userId));
      const [b] = await db.select({ balance: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId));
      const [s] = await db.select({ games: userStats.games }).from(userStats).where(eq(userStats.userId, userId));
      const rows = await db.select({ k: userAvatars.avatarKey }).from(userAvatars).where(eq(userAvatars.userId, userId));
      return { avatarKey: u?.avatarKey ?? CHARACTER_AVATAR_KEYS[0]!, balance: b?.balance ?? 0, games: s?.games ?? 0, inviteRedeemed: !!u?.chatUnlockedAt, bought: new Set(rows.map((r) => r.k)) };
    },
    async buy(userId, key, price) {
      return db.transaction(async (tx): Promise<AvatarChange> => {
        const [row] = await tx.select({ k: avatarCatalog.avatarKey }).from(avatarCatalog).where(and(eq(avatarCatalog.avatarKey, key), eq(avatarCatalog.isActive, true)));
        if (!row) return 'unknown';
        // The (player, avatar) key makes a double tap a no-op: the second purchase finds the ledger entry and pays nothing.
        const out = await applyLedgerEntry(tx, { userId, delta: -price, reason: 'shop_purchase', refType: 'avatar', refId: key, idempotencyKey: `avatar:${userId}:${key}` });
        if (!out.applied && out.reason === 'insufficient') return 'insufficient';
        await tx.insert(userAvatars).ignore().values({ userId, avatarKey: key });
        await tx.update(users).set({ avatarKey: key }).where(eq(users.id, userId));
        return 'ok';
      });
    },
  };
}
