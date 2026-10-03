import { tehranDayStart } from '@dozari/shared';
import type { Shop, ShopItem } from '@dozari/shared';
import type { PurchaseOutcome, ShopItemRow, ShopStore } from './shop-store.js';

export type BuyResult = PurchaseOutcome | { ok: false; error: 'level' | 'unknown_item'; minLevel?: number };

const toView = (row: ShopItemRow, level: number, balance: number, gems: number, bought: number): ShopItem => {
  const leftToday = row.perDayLimit > 0 ? Math.max(0, row.perDayLimit - bought) : null;
  const blocked = level < row.minLevel ? 'LEVEL' : leftToday === 0 ? 'DAILY_LIMIT' : row.currency === 'gems' ? (gems < row.priceGems ? 'GEMS' : null) : balance < row.priceCoins ? 'COINS' : null;
  return { id: row.id, titleFa: row.titleFa, descriptionFa: row.descriptionFa, effect: row.effect, amount: row.amount, currency: row.currency, priceCoins: row.priceCoins, priceGems: row.priceGems, minLevel: row.minLevel, iconKey: row.iconKey, blocked, leftToday };
};

/** The coin shop: what a player sees and what a purchase checks (level, daily limit, coins). */
export class ShopService {
  constructor(
    private readonly store: ShopStore,
    private readonly levelOf: (userId: string) => Promise<number>,
    private readonly now: () => number = Date.now,
  ) {}

  async shop(userId: string): Promise<Shop> {
    const [items, wallet, level] = await Promise.all([this.store.items(), this.store.wallet(userId), this.levelOf(userId)]);
    const since = tehranDayStart(this.now());
    const views = await Promise.all(items.map(async (row) => toView(row, level, wallet.balance, wallet.gems, row.perDayLimit > 0 ? await this.store.boughtSince(userId, row.id, since) : 0)));
    return { items: views, balance: wallet.balance, gems: wallet.gems, level, tokens: wallet.tokens };
  }

  async buy(userId: string, itemId: string): Promise<BuyResult> {
    const item = await this.store.item(itemId);
    if (!item || !item.isActive) return { ok: false, error: 'unknown_item' };
    const level = await this.levelOf(userId);
    if (level < item.minLevel) return { ok: false, error: 'level', minLevel: item.minLevel };
    return this.store.purchase(userId, itemId, tehranDayStart(this.now()));
  }
}
