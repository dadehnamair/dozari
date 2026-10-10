import { SHOP_GIFT_EFFECTS, SHOP_GIFT_MAX_COINS, DAILY_SHOP_SLOTS, STREAK_SHIELD_MAX_HELD, dailyDateKey, pickDailyShop, tehranDayStart } from '@dozari/shared';
import type { Shop, ShopItem } from '@dozari/shared';
import type { GiftOutcome, PurchaseOutcome, ShopItemRow, ShopStore } from './shop-store.js';

export type GiftResult = GiftOutcome | { ok: false; error: 'level' | 'unknown_item' | 'not_giftable' | 'not_friends' | 'not_birthday' | 'self'; minLevel?: number };

export type BuyResult = PurchaseOutcome | { ok: false; error: 'level' | 'unknown_item' | 'not_today'; minLevel?: number };

const toView = (row: ShopItemRow, level: number, balance: number, gems: number, bought: number, wardrobe: Map<string, boolean>, shields = 0): ShopItem => {
  const owned = row.effect === 'cosmetic' && wardrobe.has(row.id);
  const leftToday = row.perDayLimit > 0 ? Math.max(0, row.perDayLimit - bought) : null;
  const maxHeld = row.effect === 'streak_shield' && shields + row.amount > STREAK_SHIELD_MAX_HELD;
  const blocked = owned ? 'OWNED' : level < row.minLevel ? 'LEVEL' : maxHeld ? 'MAX_HELD' : leftToday === 0 ? 'DAILY_LIMIT' : row.currency === 'gems' ? (gems < row.priceGems ? 'GEMS' : null) : balance < row.priceCoins ? 'COINS' : null;
  return { id: row.id, titleFa: row.titleFa, descriptionFa: row.descriptionFa, effect: row.effect, amount: row.amount, currency: row.currency, priceCoins: row.priceCoins, priceGems: row.priceGems, priceToman: Math.floor(row.priceRials / 10), minLevel: row.minLevel, iconKey: row.iconKey, slot: row.slot, owned, equipped: owned && wardrobe.get(row.id) === true, blocked, leftToday, rotating: row.rotating === true };
};

/** The coin shop: what a player sees and what a purchase checks (level, daily limit, coins). */
export class ShopService {
  constructor(
    private readonly store: ShopStore,
    private readonly levelOf: (userId: string) => Promise<number>,
    private readonly now: () => number = Date.now,
    /** Rotating items on offer per day (setting `shop.daily_slots`). */
    private readonly dailySlots: () => Promise<number> = async () => DAILY_SHOP_SLOTS,
    /** May `giver` give `to` a gift now (friends, and `to` is in their birthday week)? `key` is the once-per-birthday key. */
    private readonly giftGuard?: (giver: string, to: string) => Promise<{ ok: true; key: string } | { ok: false; error: 'not_friends' | 'not_birthday' }>,
    /** Called after a gift was bought (to tell the friend). */
    private readonly onGifted?: (giver: string, to: string, item: { titleFa: string; iconKey: string | null }) => void,
  ) {}

  /** Ids of the rotating items on offer today, or null when nothing rotates (every item is always on offer). */
  private async todaysRotation(items: readonly ShopItemRow[]): Promise<Set<string> | null> {
    const pool = items.filter((i) => i.rotating === true).map((i) => i.id);
    if (pool.length === 0) return null;
    return new Set(pickDailyShop(pool, dailyDateKey(this.now()), await this.dailySlots()));
  }

  async shop(userId: string): Promise<Shop> {
    const [items, wallet, level, wardrobe] = await Promise.all([this.store.items(), this.store.wallet(userId), this.levelOf(userId), this.store.owned(userId)]);
    const since = tehranDayStart(this.now());
    const today = await this.todaysRotation(items);
    const offered = today ? items.filter((i) => i.rotating !== true || today.has(i.id)) : items;
    const views = await Promise.all(offered.map(async (row) => toView(row, level, wallet.balance, wallet.gems, row.perDayLimit > 0 ? await this.store.boughtSince(userId, row.id, since) : 0, wardrobe, wallet.shields ?? 0)));
    return { items: views, balance: wallet.balance, gems: wallet.gems, level, tokens: wallet.tokens, shields: wallet.shields ?? 0, rotatesAt: today ? since + 86_400_000 : null };
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
    if (item.rotating === true) {
      const today = await this.todaysRotation(await this.store.items());
      if (today && !today.has(item.id)) return { ok: false, error: 'not_today' };
    }
    return this.store.purchase(userId, itemId, tehranDayStart(this.now()));
  }

  /**
   * A small gift for a friend whose birthday week it is: a coin-priced hint pack or wheel spin (never an owned item), paid by the giver,
   * once per friend per birthday. The friend is told in their inbox.
   */
  async gift(giverId: string, toId: string, itemId: string): Promise<GiftResult> {
    if (giverId === toId) return { ok: false, error: 'self' };
    const item = await this.store.item(itemId);
    if (!item || !item.isActive) return { ok: false, error: 'unknown_item' };
    if (!(SHOP_GIFT_EFFECTS as readonly string[]).includes(item.effect) || item.currency !== 'coins' || item.priceCoins <= 0 || item.priceCoins > SHOP_GIFT_MAX_COINS || item.rotating === true) return { ok: false, error: 'not_giftable' };
    const level = await this.levelOf(giverId);
    if (level < item.minLevel) return { ok: false, error: 'level', minLevel: item.minLevel };
    const guard = this.giftGuard ? await this.giftGuard(giverId, toId) : ({ ok: false, error: 'not_friends' } as const);
    if (!guard.ok) return guard;
    const out = await this.store.gift(giverId, toId, itemId, `${guard.key}:${itemId}`);
    if (out.ok) {
      try {
        this.onGifted?.(giverId, toId, { titleFa: item.titleFa, iconKey: item.iconKey });
      } catch {
        /* telling the friend never undoes the gift */
      }
    }
    return out;
  }
}
