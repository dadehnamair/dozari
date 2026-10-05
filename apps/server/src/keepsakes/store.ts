import { and, asc, eq, inArray, keepsakeDefs, keepsakeSets, products, sql, userBalances, userKeepsakePieces, userKeepsakeSets, userKeepsakes } from '@dozari/db';
import type { Db } from '@dozari/db';
import { KEEPSAKE_MAX_LEVEL, SHOWCASE_MAX, shopPiece, upgradeCost } from '@dozari/shared';
import type { KeepsakeRarity } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';
import { applyGemEntry } from '../economy/gems.js';
import { applyLedgerEntry } from '../economy/ledger.js';

export interface DefRow {
  id: string;
  productId: string | null;
  titleFa: string;
  storyFa: string;
  eraYear: number | null;
  rarity: KeepsakeRarity;
  pieces: number;
  artKey: string | null;
  setId: string | null;
  rewardGems: number;
  sortOrder: number;
  isActive: boolean;
  /** Catalog icon of the product it is made from. */
  iconKey: string | null;
}
export type NewDef = Omit<DefRow, 'id' | 'sortOrder' | 'iconKey'>;

export interface SetRow {
  id: string;
  titleFa: string;
  rewardGems: number;
  sortOrder: number;
  isActive: boolean;
}
export type NewSet = Omit<SetRow, 'id' | 'sortOrder'>;

/** One player's state on one keepsake. */
export interface Owned {
  owned: number[];
  completed: boolean;
  level: number;
  showcaseSlot: number | null;
}

export type GrantOutcome =
  | { ok: true; piece: number; completed: boolean; gems: number; setCompleted: boolean; balance: number }
  | { ok: false; error: 'unknown' | 'complete' | 'duplicate' | 'insufficient' };
export type UpgradeOutcome = { ok: true; level: number; balance: number } | { ok: false; error: 'unknown' | 'not_complete' | 'max' | 'insufficient' };

/** I/O boundary of the keepsake collection. Every coin or gem movement is one idempotent ledger row inside the same transaction as the grant. */
export interface KeepsakeStore {
  defs(opts?: { includeHidden?: boolean }): Promise<DefRow[]>;
  sets(opts?: { includeHidden?: boolean }): Promise<SetRow[]>;
  progress(userId: string): Promise<Map<string, Owned>>;
  completedSets(userId: string): Promise<Set<string>>;
  balance(userId: string): Promise<number>;
  /** Gives a specific piece (a drop or an admin grant). `ref` makes a replay a no-op (`duplicate`). */
  grant(userId: string, keepsakeId: string, piece: number, source: 'drop' | 'admin', ref: string): Promise<GrantOutcome>;
  /** Buys one missing piece (picked from `ref`) for `price` coins. */
  buy(userId: string, keepsakeId: string, price: number, ref: string): Promise<GrantOutcome>;
  /** Takes a completed keepsake one level up; the price is `upgradeCost(level)`. */
  upgrade(userId: string, keepsakeId: string): Promise<UpgradeOutcome>;
  /** Replaces the showcase with these completed keepsakes, in order (1..SHOWCASE_MAX). */
  setShowcase(userId: string, ids: readonly string[]): Promise<void>;
  addDef(d: NewDef): Promise<DefRow>;
  updateDef(id: string, patch: Partial<NewDef> & { sortOrder?: number }): Promise<'ok' | 'not_found'>;
  addSet(s: NewSet): Promise<SetRow>;
  updateSet(id: string, patch: Partial<NewSet> & { sortOrder?: number }): Promise<'ok' | 'not_found'>;
}

const slotOk = (n: number) => n >= 1 && n <= SHOWCASE_MAX;

export function createDbKeepsakeStore(db: Db): KeepsakeStore {
  const defRows = async (includeHidden: boolean): Promise<DefRow[]> => {
    const rows = await db
      .select({ d: keepsakeDefs, iconKey: products.iconKey })
      .from(keepsakeDefs)
      .leftJoin(products, eq(products.id, keepsakeDefs.productId))
      .where(includeHidden ? undefined : eq(keepsakeDefs.isActive, true))
      .orderBy(asc(keepsakeDefs.sortOrder), asc(keepsakeDefs.createdAt));
    return rows.map((r) => ({ ...r.d, iconKey: r.iconKey ?? null }));
  };

  /** Completion work inside the caller's transaction: mark the keepsake done, pay its gems, and the set's gems when the set is whole. */
  const completeInTx = async (tx: Parameters<Parameters<Db['transaction']>[0]>[0], userId: string, def: DefRow): Promise<{ gems: number; setCompleted: boolean }> => {
    await tx.insert(userKeepsakes).values({ userId, keepsakeId: def.id, level: 1 }).onDuplicateKeyUpdate({ set: { userId } });
    let gems = 0;
    if (def.rewardGems > 0) {
      const g = await applyGemEntry(tx, { userId, delta: def.rewardGems, reason: 'keepsake_reward', refType: 'keepsake', refId: def.id, idempotencyKey: `keepsake_reward:${def.id}:${userId}` });
      if (g.applied) gems += def.rewardGems;
    }
    let setCompleted = false;
    if (def.setId) {
      const members = await tx.select({ id: keepsakeDefs.id }).from(keepsakeDefs).where(and(eq(keepsakeDefs.setId, def.setId), eq(keepsakeDefs.isActive, true)));
      const done = members.length === 0 ? [] : await tx.select({ id: userKeepsakes.keepsakeId }).from(userKeepsakes).where(and(eq(userKeepsakes.userId, userId), inArray(userKeepsakes.keepsakeId, members.map((m) => m.id))));
      const [set] = await tx.select().from(keepsakeSets).where(eq(keepsakeSets.id, def.setId));
      if (set && set.isActive && members.length > 0 && done.length === members.length) {
        const [had] = await tx.select({ s: userKeepsakeSets.setId }).from(userKeepsakeSets).where(and(eq(userKeepsakeSets.userId, userId), eq(userKeepsakeSets.setId, set.id)));
        if (!had) {
          await tx.insert(userKeepsakeSets).values({ userId, setId: set.id });
          setCompleted = true;
          if (set.rewardGems > 0) {
            const g = await applyGemEntry(tx, { userId, delta: set.rewardGems, reason: 'keepsake_reward', refType: 'keepsake_set', refId: set.id, idempotencyKey: `keepsake_set:${set.id}:${userId}` });
            if (g.applied) gems += set.rewardGems;
          }
        }
      }
    }
    return { gems, setCompleted };
  };

  const ownedPieces = async (tx: Parameters<Parameters<Db['transaction']>[0]>[0], userId: string, keepsakeId: string): Promise<number[]> =>
    (await tx.select({ p: userKeepsakePieces.piece }).from(userKeepsakePieces).where(and(eq(userKeepsakePieces.userId, userId), eq(userKeepsakePieces.keepsakeId, keepsakeId)))).map((r) => r.p);

  const loadDef = async (tx: Parameters<Parameters<Db['transaction']>[0]>[0], id: string): Promise<DefRow | null> => {
    const [r] = await tx.select({ d: keepsakeDefs, iconKey: products.iconKey }).from(keepsakeDefs).leftJoin(products, eq(products.id, keepsakeDefs.productId)).where(eq(keepsakeDefs.id, id));
    return r && r.d.isActive ? { ...r.d, iconKey: r.iconKey ?? null } : null;
  };

  /** Serialises everything one player does here (a drop, a purchase) by locking their balance row, so two taps never pick the same piece. */
  const lock = async (tx: Parameters<Parameters<Db['transaction']>[0]>[0], userId: string): Promise<void> => {
    await tx.insert(userBalances).values({ userId, balance: 0 }).onDuplicateKeyUpdate({ set: { userId: sql`${userBalances.userId}` } });
    await tx.select({ b: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId)).for('update');
  };

  const balanceOf = async (tx: Pick<Db, 'select'>, userId: string): Promise<number> => (await tx.select({ b: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId)))[0]?.b ?? 0;

  return {
    defs: (opts) => defRows(opts?.includeHidden === true),
    async sets(opts) {
      return db.select().from(keepsakeSets).where(opts?.includeHidden ? undefined : eq(keepsakeSets.isActive, true)).orderBy(asc(keepsakeSets.sortOrder));
    },
    async progress(userId) {
      const [pieces, done] = await Promise.all([
        db.select().from(userKeepsakePieces).where(eq(userKeepsakePieces.userId, userId)),
        db.select().from(userKeepsakes).where(eq(userKeepsakes.userId, userId)),
      ]);
      const out = new Map<string, Owned>();
      for (const p of pieces) {
        const cur = out.get(p.keepsakeId) ?? { owned: [], completed: false, level: 0, showcaseSlot: null };
        cur.owned.push(p.piece);
        out.set(p.keepsakeId, cur);
      }
      for (const d of done) {
        const cur = out.get(d.keepsakeId) ?? { owned: [], completed: false, level: 0, showcaseSlot: null };
        out.set(d.keepsakeId, { ...cur, completed: true, level: d.level, showcaseSlot: d.showcaseSlot });
      }
      for (const v of out.values()) v.owned.sort((a, b) => a - b);
      return out;
    },
    async completedSets(userId) {
      return new Set((await db.select({ s: userKeepsakeSets.setId }).from(userKeepsakeSets).where(eq(userKeepsakeSets.userId, userId))).map((r) => r.s));
    },
    balance: (userId) => balanceOf(db, userId),

    async grant(userId, keepsakeId, piece, source, ref) {
      return db.transaction(async (tx): Promise<GrantOutcome> => {
        await lock(tx, userId);
        const def = await loadDef(tx, keepsakeId);
        if (!def || piece < 1 || piece > def.pieces) return { ok: false, error: 'unknown' };
        const [seen] = await tx.select({ r: userKeepsakePieces.ref }).from(userKeepsakePieces).where(and(eq(userKeepsakePieces.userId, userId), eq(userKeepsakePieces.ref, ref)));
        if (seen) return { ok: false, error: 'duplicate' };
        const have = await ownedPieces(tx, userId, keepsakeId);
        if (have.includes(piece)) return { ok: false, error: 'duplicate' };
        await tx.insert(userKeepsakePieces).values({ userId, keepsakeId, piece, source, ref });
        const completed = have.length + 1 >= def.pieces;
        const extra = completed ? await completeInTx(tx, userId, def) : { gems: 0, setCompleted: false };
        return { ok: true, piece, completed, gems: extra.gems, setCompleted: extra.setCompleted, balance: await balanceOf(tx, userId) };
      }).catch((e: unknown) => {
        if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'ER_DUP_ENTRY') return { ok: false, error: 'duplicate' } as const;
        throw e;
      });
    },

    async buy(userId, keepsakeId, price, ref) {
      return db.transaction(async (tx): Promise<GrantOutcome> => {
        await lock(tx, userId);
        const def = await loadDef(tx, keepsakeId);
        if (!def) return { ok: false, error: 'unknown' };
        const have = await ownedPieces(tx, userId, keepsakeId);
        const piece = shopPiece(def, { owned: have }, ref);
        if (piece === null) return { ok: false, error: 'complete' };
        const paid = await applyLedgerEntry(tx, { userId, delta: -price, reason: 'keepsake_piece', refType: 'keepsake', refId: keepsakeId, idempotencyKey: `keepsake_piece:${ref}:${userId}` });
        if (!paid.applied) return { ok: false, error: paid.reason === 'duplicate' ? 'duplicate' : 'insufficient' };
        await tx.insert(userKeepsakePieces).values({ userId, keepsakeId, piece, source: 'shop', ref });
        const completed = have.length + 1 >= def.pieces;
        const extra = completed ? await completeInTx(tx, userId, def) : { gems: 0, setCompleted: false };
        return { ok: true, piece, completed, gems: extra.gems, setCompleted: extra.setCompleted, balance: await balanceOf(tx, userId) };
      });
    },

    async upgrade(userId, keepsakeId) {
      return db.transaction(async (tx): Promise<UpgradeOutcome> => {
        const def = await loadDef(tx, keepsakeId);
        if (!def) return { ok: false, error: 'unknown' };
        const [row] = await tx.select().from(userKeepsakes).where(and(eq(userKeepsakes.userId, userId), eq(userKeepsakes.keepsakeId, keepsakeId))).for('update');
        if (!row) return { ok: false, error: 'not_complete' };
        const cost = upgradeCost(row.level);
        if (cost === null || row.level >= KEEPSAKE_MAX_LEVEL) return { ok: false, error: 'max' };
        const paid = await applyLedgerEntry(tx, { userId, delta: -cost, reason: 'keepsake_upgrade', refType: 'keepsake', refId: keepsakeId, idempotencyKey: `keepsake_upgrade:${keepsakeId}:${row.level}:${userId}` });
        if (!paid.applied) return { ok: false, error: paid.reason === 'duplicate' ? 'max' : 'insufficient' };
        await tx.update(userKeepsakes).set({ level: row.level + 1 }).where(and(eq(userKeepsakes.userId, userId), eq(userKeepsakes.keepsakeId, keepsakeId)));
        return { ok: true, level: row.level + 1, balance: paid.balance };
      });
    },

    async setShowcase(userId, ids) {
      await db.transaction(async (tx) => {
        await tx.update(userKeepsakes).set({ showcaseSlot: null }).where(eq(userKeepsakes.userId, userId));
        for (const [i, id] of ids.entries()) {
          if (!slotOk(i + 1)) break;
          await tx.update(userKeepsakes).set({ showcaseSlot: i + 1 }).where(and(eq(userKeepsakes.userId, userId), eq(userKeepsakes.keepsakeId, id)));
        }
      });
    },

    async addDef(d) {
      const id = uuidv7();
      const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`COUNT(*)` }).from(keepsakeDefs);
      await db.insert(keepsakeDefs).values({ ...d, id, sortOrder: Number(n) });
      const [row] = await defRows(true).then((r) => r.filter((x) => x.id === id));
      return row!;
    },
    async updateDef(id, patch) {
      const [row] = await db.select({ id: keepsakeDefs.id }).from(keepsakeDefs).where(eq(keepsakeDefs.id, id));
      if (!row) return 'not_found';
      await db.update(keepsakeDefs).set(patch).where(eq(keepsakeDefs.id, id));
      return 'ok';
    },
    async addSet(s) {
      const id = uuidv7();
      const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`COUNT(*)` }).from(keepsakeSets);
      await db.insert(keepsakeSets).values({ ...s, id, sortOrder: Number(n) });
      return { ...s, id, sortOrder: Number(n) };
    },
    async updateSet(id, patch) {
      const [row] = await db.select({ id: keepsakeSets.id }).from(keepsakeSets).where(eq(keepsakeSets.id, id));
      if (!row) return 'not_found';
      await db.update(keepsakeSets).set(patch).where(eq(keepsakeSets.id, id));
      return 'ok';
    },
  };
}
