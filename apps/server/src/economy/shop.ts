import { tehranDayStart } from '@dozari/shared';
import type { Shop, ShopItem } from '@dozari/shared';
import type { PurchaseOutcome, ShopItemRow, ShopStore } from './shop-store.js';

export type BuyResult = PurchaseOutcome | { ok: false; error: 'level' | 'unknown_item'; minLevel?: number };

const toView = (row: ShopItemRow, level: number, balance: number, gems: number, bought: number, wardrobe: Map<string, boolean>): ShopItem => {
  const owned = row.effect === 'cosmetic' && wardrobe.has(row.id);
  const leftToday = row.perDayLimit > 0 ? Math.max(0, row.perDayLimit - bought) : null;
  const blocked = owned ? 'OWNED' : level < row.minLevel ? 'LEVEL' : leftToday === 0 ? 'DAILY_LIMIT' : row.currency === 'gems' ? (gems < row.priceGems ? 'GEMS' : null) : balance < row.priceCoins ? 'COINS' : null;
  return { id: row.id, titleFa: row.titleFa, descriptionFa: row.descriptionFa, effect: row.effect, amount: row.amount, currency: row.currency, priceCoins: row.priceCoins, priceGems: row.priceGems, minLevel: row.minLevel, iconKey: row.iconKey, slot: row.slot, owned, equipped: owned && wardrobe.get(row.id) === true, blocked, leftToday };
};

/** The coin shop: what a player sees and what a purchase checks (level, daily limit, coins). */
export class ShopService {
  constructor(
    private readonly store: ShopStore,
    private readonly levelOf: (userId: string) => Promise<number>,
    private readonly now: () => number = Date.now,
  ) {}

  async shop(userId: string): Promise<Shop> {
    const [items, wallet, level, wardrobe] = await Promise.all([this.store.items(), this.store.wallet(userId), this.levelOf(userId), this.store.owned(userId)]);
    const since = tehranDayStart(this.now());
    const views = await Promise.all(items.map(async (row) => toView(row, level, wallet.balance, wallet.gems, row.perDayLimit > 0 ? await this.store.boughtSince(userId, row.id, since) : 0, wardrobe)));
    return { items: views, balance: wallet.balance, gems: wallet.gems, level, tokens: wallet.tokens };
  }

  /** Wear or take off a cosmetic the player owns. */
  async equip(userId: string, itemId: string, equipped: boolean) {
    return this.store.setEquipped(userId, itemId, equipped);
  }

  /** The cosmetics the player wears now (for drawing the avatar). */
  async worn(userId: string): Promise<{ id: string; slot: string; iconKey: string | null }[]> {
    const [items, wardrobe] = await Promise.all([this.store.items({ includeHidden: true }), this.store.owned(userId)]);
    return items.filter((i) => i.effect === 'cosmetic' && i.slot && wardrobe.get(i.id) === true).map((i) => ({ id: i.id, slot: i.slot!, iconKey: i.iconKey }));
  }

  async buy(userId: string, itemId: string): Promise<BuyResult> {
    const item = await this.store.item(itemId);
    if (!item || !item.isActive) return { ok: false, error: 'unknown_item' };
    const level = await this.levelOf(userId);
    if (level < item.minLevel) return { ok: false, error: 'level', minLevel: item.minLevel };
    return this.store.purchase(userId, itemId, tehranDayStart(this.now()));
  }
}
