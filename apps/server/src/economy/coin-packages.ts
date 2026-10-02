import type { CoinPackageRow, CoinPackageStore, NewCoinPackage, PurchaseStore } from './coin-packages-store.js';

export interface StoreReceipt {
  store: PurchaseStore;
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

  admin = {
    list: () => this.store.packages({ includeHidden: true }),
    add: (p: NewCoinPackage) => this.store.addPackage(p),
    update: (id: string, patch: Partial<NewCoinPackage>) => this.store.updatePackage(id, patch),
  };
}
