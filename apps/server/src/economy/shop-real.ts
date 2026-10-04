import type { BaleInvoice, BalePaid, PreCheckout, ReceiptVerifier, StoreReceipt } from './coin-packages.js';
import { refusingVerifier } from './coin-packages.js';
import type { ShopItemRow, ShopStore } from './shop-store.js';

const PAYLOAD = /^si:([0-9a-f-]{36}):([0-9a-f-]{36})$/;
export const shopInvoicePayload = (itemId: string, userId: string): string => `si:${itemId}:${userId}`;
export function parseShopPayload(payload: string): { itemId: string; userId: string } | null {
  const m = PAYLOAD.exec(payload);
  return m ? { itemId: m[1]!, userId: m[2]! } : null;
}

export type ShopPayError = 'unknown_item' | 'level' | 'not_for_sale' | 'owned' | 'no_sku' | 'not_verified';
export type ShopRedeem = { ok: true; duplicate: boolean } | { ok: false; error: ShopPayError; minLevel?: number };

/**
 * Shop items bought for real money (D170): a Bale wallet invoice confirmed by `successful_payment`, or a Bazaar/Myket receipt the
 * server verifies. The item is granted by `ShopStore.grantPaid`; no coins or gems move. The whole thing sits behind `feature.coin_packages`.
 */
export class ShopRealMoney {
  constructor(
    private readonly store: ShopStore,
    private readonly levelOf: (userId: string) => Promise<number>,
    private readonly verifier: ReceiptVerifier = refusingVerifier,
  ) {}

  private async sellable(userId: string, itemId: string): Promise<{ ok: true; item: ShopItemRow } | { ok: false; error: ShopPayError; minLevel?: number }> {
    const item = await this.store.item(itemId);
    if (!item || !item.isActive) return { ok: false, error: 'unknown_item' };
    if (item.priceRials <= 0) return { ok: false, error: 'not_for_sale' };
    if ((await this.levelOf(userId)) < item.minLevel) return { ok: false, error: 'level', minLevel: item.minLevel };
    if (item.effect === 'cosmetic' && (await this.store.owned(userId)).has(item.id)) return { ok: false, error: 'owned' };
    return { ok: true, item };
  }

  async invoice(userId: string, itemId: string): Promise<{ ok: true; invoice: BaleInvoice } | { ok: false; error: ShopPayError; minLevel?: number }> {
    const s = await this.sellable(userId, itemId);
    if (!s.ok) return s;
    const { item } = s;
    return { ok: true, invoice: { title: item.titleFa.slice(0, 32), description: (item.descriptionFa || item.titleFa).slice(0, 255), payload: shopInvoicePayload(item.id, userId), label: item.titleFa.slice(0, 32), amountRials: item.priceRials } };
  }

  async redeem(userId: string, itemId: string, receipt: Omit<StoreReceipt, 'sku'>): Promise<ShopRedeem> {
    const s = await this.sellable(userId, itemId);
    if (!s.ok) return s;
    const sku = receipt.store === 'bazaar' ? s.item.skuBazaar : s.item.skuMyket;
    if (!sku) return { ok: false, error: 'no_sku' };
    if (!(await this.verifier.verify({ ...receipt, sku }))) return { ok: false, error: 'not_verified' };
    const out = await this.store.grantPaid(userId, itemId, receipt.store, receipt.orderId);
    return out.ok ? { ok: true, duplicate: out.duplicate } : { ok: false, error: out.error === 'owned' ? 'owned' : 'unknown_item' };
  }

  /** Bale's `pre_checkout_query` for a shop invoice: yes only for the right payer, a live item, the level and the exact price. */
  async preCheckout(payload: string, totalAmount: number, currency: string, payerUserId: string | null): Promise<PreCheckout> {
    const p = parseShopPayload(payload);
    if (!p || payerUserId === null || payerUserId !== p.userId) return { ok: false, message: 'این پرداخت برای حساب دیگری ساخته شده است.' };
    const s = await this.sellable(p.userId, p.itemId);
    if (!s.ok) return { ok: false, message: s.error === 'owned' ? 'این کالا را از قبل داری.' : s.error === 'level' ? 'سطحت برای این کالا کافی نیست.' : 'این کالا دیگر فروخته نمی‌شود.' };
    if (currency !== 'IRR' || totalAmount !== s.item.priceRials) return { ok: false, message: 'مبلغ با قیمت کالا یکی نیست.' };
    return { ok: true };
  }

  /** Bale's `successful_payment`: grant the item once per charge id; null when the payload or amount does not match an item. */
  async creditPaid(payload: string, chargeId: string, totalAmount: number): Promise<BalePaid | null> {
    const p = parseShopPayload(payload);
    if (!p || chargeId.length < 3) return null;
    const item = await this.store.item(p.itemId);
    if (!item || totalAmount !== item.priceRials) return null;
    const out = await this.store.grantPaid(p.userId, p.itemId, 'bale', chargeId.slice(0, 120));
    if (!out.ok) return null;
    return { userId: p.userId, coins: 0, balance: 0, duplicate: out.duplicate, text: item.titleFa };
  }
}
