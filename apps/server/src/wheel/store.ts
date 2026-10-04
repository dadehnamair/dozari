import { WHEEL_SLICES_DEFAULT } from '@dozari/shared';
import { and, asc, eq, isNull, shopItems, sql, userBalances, userCosmetics, userGems, userInventory, wheelPrizes, wheelSpins } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';
import { applyGemEntry } from '../economy/gems.js';
import { applyLedgerEntry } from '../economy/ledger.js';
import type { NewWheelPrize, WheelPrizeRow, WheelStore } from './service.js';

/** The prize as shown to the client (the shop item id stays server-side). */
const withoutItem = <T extends { itemId?: string }>(p: T): Omit<T, 'itemId'> => {
  const copy = { ...p };
  delete copy.itemId;
  return copy;
};

export function createDbWheelStore(db: Db): WheelStore {
  let seeded = false;
  const seed = async () => {
    if (seeded) return;
    const [r] = await db.select({ n: sql<number>`COUNT(*)` }).from(wheelPrizes);
    if (Number(r?.n ?? 0) === 0) await db.insert(wheelPrizes).values(WHEEL_SLICES_DEFAULT.map((s, i) => ({ id: uuidv7(), kind: s.kind, amount: s.amount, weight: s.weight, itemId: null, sortOrder: i })));
    seeded = true;
  };
  const pending = async (userId: string): Promise<number> => {
    const [r] = await db.select({ n: sql<number>`COUNT(*)` }).from(wheelSpins).where(and(eq(wheelSpins.userId, userId), isNull(wheelSpins.spunAt)));
    return Number(r?.n ?? 0);
  };
  const balance = async (userId: string): Promise<number> => {
    const [r] = await db.select({ b: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId));
    return r?.b ?? 0;
  };
  const gems = async (userId: string): Promise<number> => {
    const [r] = await db.select({ b: userGems.balance }).from(userGems).where(eq(userGems.userId, userId));
    return r?.b ?? 0;
  };
  return {
    async grant(userId, matchId) {
      const [res] = await db.insert(wheelSpins).ignore().values({ id: uuidv7(), userId, matchId });
      return res.affectedRows > 0;
    },
    async give(userId, source, ref, count) {
      let added = 0;
      for (let i = 0; i < count; i++) {
        const [res] = await db.insert(wheelSpins).ignore().values({ id: uuidv7(), userId, source, ref: `${ref}#${i}` });
        added += res.affectedRows;
      }
      return added;
    },
    pending,
    balance,
    gems,
    async prizes(opts) {
      await seed();
      const rows = await db
        .select({ p: wheelPrizes, titleFa: shopItems.titleFa, iconKey: shopItems.iconKey })
        .from(wheelPrizes)
        .leftJoin(shopItems, eq(shopItems.id, wheelPrizes.itemId))
        .where(opts?.includeHidden ? undefined : eq(wheelPrizes.isActive, true))
        .orderBy(asc(wheelPrizes.sortOrder), asc(wheelPrizes.id));
      return rows.map((r) => ({ ...r.p, titleFa: r.titleFa, iconKey: r.iconKey }));
    },
    async addPrize(p) {
      await seed();
      const [agg] = await db.select({ top: sql<number>`COALESCE(MAX(${wheelPrizes.sortOrder}), 0)` }).from(wheelPrizes);
      const row = { ...p, id: uuidv7(), sortOrder: Number(agg?.top ?? 0) + 1 };
      await db.insert(wheelPrizes).values(row);
      return { ...row, titleFa: null, iconKey: null };
    },
    async updatePrize(id, patch) {
      const [r] = await db.select({ id: wheelPrizes.id }).from(wheelPrizes).where(eq(wheelPrizes.id, id));
      if (!r) return 'not_found';
      await db.update(wheelPrizes).set(patch).where(eq(wheelPrizes.id, id));
      return 'ok';
    },
    spin: (userId, roll, opts) =>
      db.transaction(async (tx) => {
        // Lock the oldest waiting spin so two taps cannot both use it.
        const [row] = await tx
          .select({ id: wheelSpins.id, matchId: wheelSpins.matchId })
          .from(wheelSpins)
          .where(and(eq(wheelSpins.userId, userId), isNull(wheelSpins.spunAt)))
          .orderBy(asc(wheelSpins.createdAt), asc(wheelSpins.id))
          .limit(1)
          .for('update');
        if (!row) return null;
        const prize = roll();
        let duplicate = false;
        await tx.update(wheelSpins).set({ coins: prize.kind === 'coins' ? prize.amount : 0, prizeKind: prize.kind, prizeAmount: prize.amount, spunAt: new Date() }).where(eq(wheelSpins.id, row.id));
        const key = `wheel_spin:${row.id}`;
        const refType = row.matchId ? 'match' : 'wheel';
        const refId = row.matchId ?? row.id;
        if (prize.kind === 'coins') await applyLedgerEntry(tx, { userId, delta: prize.amount, reason: 'wheel_spin', refType, refId, idempotencyKey: key });
        else if (prize.kind === 'gems') await applyGemEntry(tx, { userId, delta: prize.amount, reason: 'wheel_prize', refType, refId, idempotencyKey: key });
        else if (prize.kind === 'hint_token') await tx.insert(userInventory).values({ userId, effect: 'hint_token', qty: prize.amount }).onDuplicateKeyUpdate({ set: { qty: sql`${userInventory.qty} + ${prize.amount}` } });
        else if (prize.kind === 'cosmetic' && prize.itemId) {
          const [res] = await tx.insert(userCosmetics).ignore().values({ userId, itemId: prize.itemId, source: 'wheel' });
          if (res.affectedRows === 0) {
            // Already owned: pay coins instead, so a win is never empty.
            duplicate = true;
            if (opts.dupeCoins > 0) await applyLedgerEntry(tx, { userId, delta: opts.dupeCoins, reason: 'wheel_spin', refType, refId, idempotencyKey: key });
          }
        } else for (let i = 0; i < prize.amount; i++) await tx.insert(wheelSpins).ignore().values({ id: uuidv7(), userId, source: 'wheel', ref: `${row.id}#${i}` });
        const [left] = await tx.select({ n: sql<number>`COUNT(*)` }).from(wheelSpins).where(and(eq(wheelSpins.userId, userId), isNull(wheelSpins.spunAt)));
        const [bal] = await tx.select({ b: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId));
        const [gem] = await tx.select({ b: userGems.balance }).from(userGems).where(eq(userGems.userId, userId));
        const shown = withoutItem(prize);
        return duplicate ? { ...shown, kind: 'coins' as const, amount: Math.max(1, opts.dupeCoins), duplicate, pending: Number(left?.n ?? 0), balance: bal?.b ?? 0, gems: gem?.b ?? 0 } : { ...shown, duplicate, pending: Number(left?.n ?? 0), balance: bal?.b ?? 0, gems: gem?.b ?? 0 };
      }),
  };
}

/** In-memory twin for tests. */
export function createMemoryWheelStore(): WheelStore & { balances: Map<string, number>; gemBalances: Map<string, number>; tokens: Map<string, number>; wardrobe: Map<string, Set<string>>; spins: { userId: string; matchId: string; coins: number | null }[] } {
  const balances = new Map<string, number>();
  const gemBalances = new Map<string, number>();
  const tokens = new Map<string, number>();
  const wardrobe = new Map<string, Set<string>>();
  const spins: { userId: string; matchId: string; coins: number | null }[] = [];
  const table: WheelPrizeRow[] = WHEEL_SLICES_DEFAULT.map((s, i) => ({ id: `00000000-0000-7000-c000-${String(i + 1).padStart(12, '0')}`, kind: s.kind, amount: s.amount, weight: s.weight, itemId: null, sortOrder: i, isActive: true }));
  const waiting = (u: string) => spins.filter((s) => s.userId === u && s.coins === null);
  return {
    balances,
    gemBalances,
    tokens,
    wardrobe,
    spins,
    async grant(userId, matchId) {
      if (spins.some((s) => s.userId === userId && s.matchId === matchId)) return false;
      spins.push({ userId, matchId, coins: null });
      return true;
    },
    async give(userId, source, ref, count) {
      let added = 0;
      for (let i = 0; i < count; i++) {
        const key = `${source}:${ref}#${i}`;
        if (spins.some((s) => s.userId === userId && s.matchId === key)) continue;
        spins.push({ userId, matchId: key, coins: null });
        added += 1;
      }
      return added;
    },
    async pending(u) {
      return waiting(u).length;
    },
    async balance(u) {
      return balances.get(u) ?? 0;
    },
    async gems(u) {
      return gemBalances.get(u) ?? 0;
    },
    async prizes(opts) {
      return table.filter((r) => opts?.includeHidden || r.isActive).map((r) => ({ ...r }));
    },
    async addPrize(p: NewWheelPrize) {
      const row = { ...p, id: `00000000-0000-7000-c000-${String(table.length + 1).padStart(12, '0')}`, sortOrder: table.length };
      table.push(row);
      return { ...row };
    },
    async updatePrize(id, patch) {
      const r = table.find((x) => x.id === id);
      if (!r) return 'not_found';
      Object.assign(r, patch);
      return 'ok';
    },
    async spin(userId, roll, opts) {
      const next = waiting(userId)[0];
      if (!next) return null;
      const prize = roll();
      next.coins = prize.kind === 'coins' ? prize.amount : 0;
      if (prize.kind === 'coins') balances.set(userId, (balances.get(userId) ?? 0) + prize.amount);
      else if (prize.kind === 'gems') gemBalances.set(userId, (gemBalances.get(userId) ?? 0) + prize.amount);
      else if (prize.kind === 'hint_token') tokens.set(userId, (tokens.get(userId) ?? 0) + prize.amount);
      else if (prize.kind === 'cosmetic' && prize.itemId) {
        const mine = wardrobe.get(userId) ?? new Set<string>();
        wardrobe.set(userId, mine);
        if (mine.has(prize.itemId)) {
          balances.set(userId, (balances.get(userId) ?? 0) + opts.dupeCoins);
          const shown = withoutItem(prize);
          return { ...shown, kind: 'coins', amount: Math.max(1, opts.dupeCoins), duplicate: true, pending: waiting(userId).length, balance: balances.get(userId) ?? 0, gems: gemBalances.get(userId) ?? 0 };
        }
        mine.add(prize.itemId);
      } else for (let i = 0; i < prize.amount; i++) spins.push({ userId, matchId: `wheel:${spins.length}`, coins: null });
      const shown = withoutItem(prize);
      return { ...shown, duplicate: false, pending: waiting(userId).length, balance: balances.get(userId) ?? 0, gems: gemBalances.get(userId) ?? 0 };
    },
  };
}
