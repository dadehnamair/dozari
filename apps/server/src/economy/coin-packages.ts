import type { CoinPackageRow, CoinPackageStore, NewCoinPackage, ReceiptStore } from './coin-packages-store.js';

export interface StoreReceipt {
  store: ReceiptStore;
  sku: string;
  orderId: string;
  /** The opaque token the store app gave the client. */
  token: string;
}

/** Asks the store's server-side API whether a receipt is real and paid. Bazaar/Myket adapters plug in here later. */
export interface ReceiptVerifier {
  verify(receipt: StoreReceipt): Promise<boolean>;
}

/** Until a real store adapter is wired in, nothing is ever verified, so no coin can be bought by accident. */
export const refusingVerifier: ReceiptVerifier = { verify: async () => false };

export type RedeemResult =
  | { ok: true; balance: number; coins: number; duplicate: boolean }
  | { ok: false; error: 'unknown_package' | 'level' | 'no_sku' | 'not_verified'; minLevel?: number };

/** What goes into a Bale `sendInvoice` for one package (amount in integer rials, rule 2). */
export interface BaleInvoice {
  title: string;
  description: string;
  /** `cp:<packageId>:<userId>`: comes back in `pre_checkout_query` and `successful_payment`. */
  payload: string;
  label: string;
  amountRials: number;
}

const PAYLOAD = /^cp:([0-9a-f-]{36}):([0-9a-f-]{36})$/;
export const invoicePayload = (packageId: string, userId: string): string => `cp:${packageId}:${userId}`;
export function parseInvoicePayload(payload: string): { packageId: string; userId: string } | null {
  const m = PAYLOAD.exec(payload);
  return m ? { packageId: m[1]!, userId: m[2]! } : null;
}

export type PreCheckout = { ok: true } | { ok: false; message: string };
/** `text` set = a shop item bought (its name), not coins. */
export type BalePaid = { userId: string; coins: number; balance: number; duplicate: boolean; text?: string };

export type CoinPackageView = Pick<CoinPackageRow, 'id' | 'titleFa' | 'coins' | 'minLevel'> & { priceToman: number; locked: boolean };

/** Coin packages bought for real money: the catalog and the verified-receipt credit. The whole feature sits behind `feature.coin_packages`. */
export class CoinPackageService {
  constructor(
    private readonly store: CoinPackageStore,
    private readonly levelOf: (userId: string) => Promise<number>,
    private readonly verifier: ReceiptVerifier = refusingVerifier,
  ) {}

  async list(userId: string): Promise<CoinPackageView[]> {
    const level = await this.levelOf(userId);
    return (await this.store.packages()).map((p) => ({ id: p.id, titleFa: p.titleFa, coins: p.coins, minLevel: p.minLevel, priceToman: Number(p.priceRials / 10n), locked: level < p.minLevel }));
  }

  async redeem(userId: string, packageId: string, receipt: Omit<StoreReceipt, 'sku'>): Promise<RedeemResult> {
    const pkg = await this.store.package(packageId);
    if (!pkg || !pkg.isActive) return { ok: false, error: 'unknown_package' };
    const level = await this.levelOf(userId);
    if (level < pkg.minLevel) return { ok: false, error: 'level', minLevel: pkg.minLevel };
    const sku = receipt.store === 'bazaar' ? pkg.skuBazaar : pkg.skuMyket;
    if (!sku) return { ok: false, error: 'no_sku' };
    if (!(await this.verifier.verify({ ...receipt, sku }))) return { ok: false, error: 'not_verified' };
    const out = await this.store.credit(userId, pkg, receipt.store, receipt.orderId);
    return { ok: true, balance: out.balance, coins: pkg.coins, duplicate: out.duplicate };
  }

  /** The invoice for a package the player may buy now; the caller sends it through the Bale bot. */
  async invoice(userId: string, packageId: string): Promise<{ ok: true; invoice: BaleInvoice } | { ok: false; error: 'unknown_package' | 'level'; minLevel?: number }> {
    const pkg = await this.store.package(packageId);
    if (!pkg || !pkg.isActive) return { ok: false, error: 'unknown_package' };
    if ((await this.levelOf(userId)) < pkg.minLevel) return { ok: false, error: 'level', minLevel: pkg.minLevel };
    return { ok: true, invoice: { title: pkg.titleFa.slice(0, 32), description: `${pkg.coins} سکه برای دوزاری`.slice(0, 255), payload: invoicePayload(pkg.id, userId), label: pkg.titleFa.slice(0, 32), amountRials: Number(pkg.priceRials) } };
  }

  /**
   * Bale's `pre_checkout_query`: say yes only when the payer is the player the invoice was made for, the package is still on sale, the level
   * still allows it and the amount is exactly the price. Nothing is credited here (only `successful_payment` counts).
   */
  async preCheckout(payload: string, totalAmount: number, currency: string, payerUserId: string | null): Promise<PreCheckout> {
    const p = parseInvoicePayload(payload);
    if (!p || payerUserId === null || payerUserId !== p.userId) return { ok: false, message: 'این پرداخت برای حساب دیگری ساخته شده است.' };
    const pkg = await this.store.package(p.packageId);
    if (!pkg || !pkg.isActive) return { ok: false, message: 'این بسته دیگر فروخته نمی‌شود.' };
    if ((await this.levelOf(p.userId)) < pkg.minLevel) return { ok: false, message: 'سطحت برای این بسته کافی نیست.' };
    if (currency !== 'IRR' || totalAmount !== Number(pkg.priceRials)) return { ok: false, message: 'مبلغ با قیمت بسته یکی نیست.' };
    return { ok: true };
  }

  /** Bale's `successful_payment`: credit the package once per `telegram_payment_charge_id`; null when the payload or amount does not match a package. */
  async creditPaid(payload: string, chargeId: string, totalAmount: number): Promise<BalePaid | null> {
    const p = parseInvoicePayload(payload);
    if (!p || chargeId.length < 3) return null;
    const pkg = await this.store.package(p.packageId);
    if (!pkg || totalAmount !== Number(pkg.priceRials)) return null;
    const out = await this.store.credit(p.userId, pkg, 'bale', chargeId.slice(0, 120));
    return { userId: p.userId, coins: pkg.coins, balance: out.balance, duplicate: out.duplicate };
  }

  admin = {
    list: () => this.store.packages({ includeHidden: true }),
    add: (p: NewCoinPackage) => this.store.addPackage(p),
    update: (id: string, patch: Partial<NewCoinPackage>) => this.store.updatePackage(id, patch),
  };
}
