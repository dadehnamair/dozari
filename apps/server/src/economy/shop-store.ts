import { and, asc, eq, gte, shopItems, shopPurchases, sql, userBalances, userInventory, wheelSpins } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';
import { applyLedgerEntry } from './ledger.js';

export type ShopEffect = 'hint_token' | 'wheel_spin';

export interface ShopItemRow {
  id: string;
  titleFa: string;
  descriptionFa: string;
  effect: ShopEffect;
  amount: number;
  priceCoins: number;
  minLevel: number;
  perDayLimit: number;
  iconKey: string | null;
  sortOrder: number;
  isActive: boolean;
}

export type NewShopItem = Omit<ShopItemRow, 'id' | 'sortOrder'>;

export type PurchaseOutcome = { ok: true; balance: number; tokens: number } | { ok: false; error: 'insufficient' | 'daily_limit' | 'unavailable' };
export type SpendOutcome = { ok: true; paidWith: 'coins' | 'token'; balance: number; tokens: number } | { ok: false; error: 'insufficient' };

/** I/O boundary of the coin shop and the hint payment. Every coin movement goes through the ledger inside one transaction. */
export interface ShopStore {
  items(opts?: { includeHidden?: boolean }): Promise<ShopItemRow[]>;
  item(id: string): Promise<ShopItemRow | null>;
  addItem(item: NewShopItem): Promise<ShopItemRow>;
  updateItem(id: string, patch: Partial<NewShopItem> & { sortOrder?: number }): Promise<'ok' | 'not_found'>;
  wallet(userId: string): Promise<{ balance: number; tokens: number }>;
  /** Purchases of one item by this player since `sinceMs`. */
  boughtSince(userId: string, itemId: string, sinceMs: number): Promise<number>;
  /** Buys one item: checks balance and the daily limit, debits coins (`shop_purchase`) and grants the effect, all or nothing. */
  purchase(userId: string, itemId: string, sinceMs: number): Promise<PurchaseOutcome>;
  /** Pays for one hint: a hint token if the player has one, else `price` coins (`hint_purchase`). `key` makes a retry a no-op. */
  spendOnHint(userId: string, price: number, key: string): Promise<SpendOutcome>;
}

export const DEFAULT_SHOP_ITEMS: readonly NewShopItem[] = [
  { titleFa: 'یک راهنما', descriptionFa: 'یک بار راهنما گرفتن در بازی تکی، بدون پرداخت سکه در همان لحظه.', effect: 'hint_token', amount: 1, priceCoins: 20, minLevel: 2, perDayLimit: 0, iconKey: 'magnifier', isActive: true },
  { titleFa: 'بسته‌ی پنج‌تایی راهنما', descriptionFa: 'پنج راهنما با تخفیف نسبت به خرید تکی.', effect: 'hint_token', amount: 5, priceCoins: 80, minLevel: 3, perDayLimit: 3, iconKey: 'potion', isActive: true },
  // Higher tiers open further along the level road (docs/logic/progression.md §Level rewards).
  { titleFa: 'بسته‌ی ده‌تایی راهنما', descriptionFa: 'ده راهنما، ارزان‌تر از خرید جدا.', effect: 'hint_token', amount: 10, priceCoins: 150, minLevel: 10, perDayLimit: 3, iconKey: 'magnifier', isActive: true },
  { titleFa: 'بسته‌ی بیست‌تایی راهنما', descriptionFa: 'بیست راهنما برای بازی‌های سخت‌تر.', effect: 'hint_token', amount: 20, priceCoins: 280, minLevel: 20, perDayLimit: 2, iconKey: 'potion', isActive: true },
  { titleFa: 'صندوق راهنما', descriptionFa: 'پنجاه راهنما؛ مخصوص بازیکن‌های باتجربه.', effect: 'hint_token', amount: 50, priceCoins: 600, minLevel: 35, perDayLimit: 1, iconKey: 'chest', isActive: true },
  // Lucky-wheel spins: an average spin pays about 13 coins, so a spin costs more than it returns (a coin sink, but a fun one).
  { titleFa: 'یک چرخش گردونه', descriptionFa: 'یک بار گردونه‌ی شانس را بچرخان؛ شاید سکه‌ی بیشتری برگردد!', effect: 'wheel_spin', amount: 1, priceCoins: 25, minLevel: 3, perDayLimit: 0, iconKey: 'dice', isActive: true },
  { titleFa: 'بسته‌ی پنج چرخش گردونه', descriptionFa: 'پنج چرخش گردونه با تخفیف.', effect: 'wheel_spin', amount: 5, priceCoins: 100, minLevel: 5, perDayLimit: 3, iconKey: 'gift', isActive: true },
];

export function createDbShopStore(db: Db): ShopStore {
  let seeded = false;
  const seed = async () => {
    if (seeded) return;
    // Add every default item the table does not have yet (by title), so shops seeded before a tier existed get it too.
    const have = new Set((await db.select({ t: shopItems.titleFa }).from(shopItems)).map((r) => r.t));
    const missing = DEFAULT_SHOP_ITEMS.map((it, i) => ({ it, i })).filter(({ it }) => !have.has(it.titleFa));
    if (missing.length > 0) await db.insert(shopItems).values(missing.map(({ it, i }) => ({ ...it, id: uuidv7(), sortOrder: i })));
    seeded = true;
  };
  const toRow = (r: typeof shopItems.$inferSelect): ShopItemRow => ({ ...r });
  const tokensOf = async (tx: Pick<Db, 'select'>, userId: string): Promise<number> => {
    const [r] = await tx.select({ qty: userInventory.qty }).from(userInventory).where(and(eq(userInventory.userId, userId), eq(userInventory.effect, 'hint_token')));
    return r?.qty ?? 0;
  };
  return {
    async items(opts) {
      await seed();
      const rows = await db.select().from(shopItems).where(opts?.includeHidden ? undefined : eq(shopItems.isActive, true)).orderBy(asc(shopItems.sortOrder));
      return rows.map(toRow);
    },
    async item(id) {
      await seed();
      const [r] = await db.select().from(shopItems).where(eq(shopItems.id, id));
      return r ? toRow(r) : null;
    },
    async addItem(item) {
      await seed();
      const [agg] = await db.select({ top: sql<number>`COALESCE(MAX(${shopItems.sortOrder}), 0)` }).from(shopItems);
      const row = { ...item, id: uuidv7(), sortOrder: Number(agg?.top ?? 0) + 1 };
      await db.insert(shopItems).values(row);
      return row;
    },
    async updateItem(id, patch) {
      const [r] = await db.select({ id: shopItems.id }).from(shopItems).where(eq(shopItems.id, id));
      if (!r) return 'not_found';
      await db.update(shopItems).set(patch).where(eq(shopItems.id, id));
      return 'ok';
    },
    async wallet(userId) {
      const [b] = await db.select({ balance: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId));
      return { balance: b?.balance ?? 0, tokens: await tokensOf(db, userId) };
    },
    async boughtSince(userId, itemId, sinceMs) {
      const [r] = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(shopPurchases)
        .where(and(eq(shopPurchases.userId, userId), eq(shopPurchases.itemId, itemId), gte(shopPurchases.createdAt, new Date(sinceMs))));
      return Number(r?.n ?? 0);
    },
    async purchase(userId, itemId, sinceMs) {
      await seed();
      return db.transaction(async (tx): Promise<PurchaseOutcome> => {
        const [item] = await tx.select().from(shopItems).where(eq(shopItems.id, itemId));
        if (!item || !item.isActive) return { ok: false, error: 'unavailable' };
        const purchaseId = uuidv7();
        // The ledger call locks this player's balance row first, which also serialises concurrent purchases (so the daily-limit count below is safe).
        const ledger = await applyLedgerEntry(tx, { userId, delta: -item.priceCoins, reason: 'shop_purchase', refType: 'shop_item', refId: item.id, idempotencyKey: `shop_purchase:${purchaseId}:${userId}` });
        if (!ledger.applied) return { ok: false, error: 'insufficient' };
        if (item.perDayLimit > 0) {
          const [c] = await tx
            .select({ n: sql<number>`COUNT(*)` })
            .from(shopPurchases)
            .where(and(eq(shopPurchases.userId, userId), eq(shopPurchases.itemId, itemId), gte(shopPurchases.createdAt, new Date(sinceMs))));
          if (Number(c?.n ?? 0) >= item.perDayLimit) throw new DailyLimit();
        }
        await tx.insert(shopPurchases).values({ id: purchaseId, userId, itemId, priceCoins: item.priceCoins });
        if (item.effect === 'wheel_spin') {
          // Wheel spins are rows of their own (one per spin), not a counter.
          for (let i = 0; i < item.amount; i++) await tx.insert(wheelSpins).values({ id: uuidv7(), userId, source: 'shop', ref: `${purchaseId}#${i}` });
        } else {
          await tx.insert(userInventory).values({ userId, effect: item.effect, qty: item.amount }).onDuplicateKeyUpdate({ set: { qty: sql`${userInventory.qty} + ${item.amount}` } });
        }
        return { ok: true, balance: ledger.balance, tokens: await tokensOf(tx, userId) };
      }).catch((e: unknown) => {
        if (e instanceof DailyLimit) return { ok: false, error: 'daily_limit' } as const;
        throw e;
      });
    },
    async spendOnHint(userId, price, key) {
      return db.transaction(async (tx): Promise<SpendOutcome> => {
        await tx.insert(userBalances).values({ userId, balance: 0 }).onDuplicateKeyUpdate({ set: { userId: sql`${userBalances.userId}` } });
        // Lock the balance row so a token and a coin payment cannot race.
        const [bal] = await tx.select({ balance: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId)).for('update');
        const tokens = await tokensOf(tx, userId);
        if (tokens > 0) {
          await tx.update(userInventory).set({ qty: sql`${userInventory.qty} - 1` }).where(and(eq(userInventory.userId, userId), eq(userInventory.effect, 'hint_token')));
          return { ok: true, paidWith: 'token', balance: bal?.balance ?? 0, tokens: tokens - 1 };
        }
        if (price === 0) return { ok: true, paidWith: 'coins', balance: bal?.balance ?? 0, tokens: 0 };
        const ledger = await applyLedgerEntry(tx, { userId, delta: -price, reason: 'hint_purchase', refType: 'solo_hint', refId: key, idempotencyKey: `hint_purchase:${key}:${userId}` });
        if (!ledger.applied) return ledger.reason === 'insufficient' ? { ok: false, error: 'insufficient' } : { ok: true, paidWith: 'coins', balance: ledger.balance, tokens: 0 };
        return { ok: true, paidWith: 'coins', balance: ledger.balance, tokens: 0 };
      });
    },
  };
}

class DailyLimit extends Error {}

/** Memory store for tests: a tiny ledger of balances, tokens and purchases, with the same rules. */
export function createMemoryShopStore(seed: readonly NewShopItem[] = DEFAULT_SHOP_ITEMS): ShopStore & { give(userId: string, coins: number, tokens?: number): void; now: { ms: number }; ledger: { userId: string; delta: number; reason: string }[] } {
  const rows: ShopItemRow[] = seed.map((s, i) => ({ ...s, id: `00000000-0000-7000-8000-${String(i + 1).padStart(12, '0')}`, sortOrder: i }));
  const balances = new Map<string, number>();
  const tokens = new Map<string, number>();
  const bought: { userId: string; itemId: string; at: number }[] = [];
  const keys = new Set<string>();
  const now = { ms: Date.now() };
  const ledger: { userId: string; delta: number; reason: string }[] = [];
  return {
    now,
    ledger,
    give(userId, coins, t = 0) {
      balances.set(userId, (balances.get(userId) ?? 0) + coins);
      tokens.set(userId, (tokens.get(userId) ?? 0) + t);
    },
    async items(opts) {
      return rows.filter((r) => opts?.includeHidden || r.isActive).map((r) => ({ ...r }));
    },
    async item(id) {
      const r = rows.find((x) => x.id === id);
      return r ? { ...r } : null;
    },
    async addItem(item) {
      const row = { ...item, id: `00000000-0000-7000-8000-${String(rows.length + 1).padStart(12, '0')}`, sortOrder: rows.length };
      rows.push(row);
      return { ...row };
    },
    async updateItem(id, patch) {
      const r = rows.find((x) => x.id === id);
      if (!r) return 'not_found';
      Object.assign(r, patch);
      return 'ok';
    },
    async wallet(userId) {
      return { balance: balances.get(userId) ?? 0, tokens: tokens.get(userId) ?? 0 };
    },
    async boughtSince(userId, itemId, since) {
      return bought.filter((b) => b.userId === userId && b.itemId === itemId && b.at >= since).length;
    },
    async purchase(userId, itemId, since) {
      const item = rows.find((r) => r.id === itemId);
      if (!item || !item.isActive) return { ok: false, error: 'unavailable' };
      if (item.perDayLimit > 0 && bought.filter((b) => b.userId === userId && b.itemId === itemId && b.at >= since).length >= item.perDayLimit) return { ok: false, error: 'daily_limit' };
      const bal = balances.get(userId) ?? 0;
      if (bal < item.priceCoins) return { ok: false, error: 'insufficient' };
      balances.set(userId, bal - item.priceCoins);
      ledger.push({ userId, delta: -item.priceCoins, reason: 'shop_purchase' });
      tokens.set(userId, (tokens.get(userId) ?? 0) + item.amount);
      bought.push({ userId, itemId, at: now.ms });
      return { ok: true, balance: balances.get(userId) ?? 0, tokens: tokens.get(userId) ?? 0 };
    },
    async spendOnHint(userId, price, key) {
      const t = tokens.get(userId) ?? 0;
      if (t > 0) {
        tokens.set(userId, t - 1);
        return { ok: true, paidWith: 'token', balance: balances.get(userId) ?? 0, tokens: t - 1 };
      }
      const bal = balances.get(userId) ?? 0;
      if (keys.has(`${key}:${userId}`)) return { ok: true, paidWith: 'coins', balance: bal, tokens: 0 };
      if (bal < price) return { ok: false, error: 'insufficient' };
      keys.add(`${key}:${userId}`);
      balances.set(userId, bal - price);
      ledger.push({ userId, delta: -price, reason: 'hint_purchase' });
      return { ok: true, paidWith: 'coins', balance: bal - price, tokens: 0 };
    },
  };
}
