import { asc, coinPackages, coinPurchases, eq } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';
import { applyLedgerEntry } from './ledger.js';

export type PurchaseStore = 'bazaar' | 'myket';

export interface CoinPackageRow {
  id: string;
  titleFa: string;
  coins: number;
  priceRials: bigint;
  skuBazaar: string | null;
  skuMyket: string | null;
  minLevel: number;
  sortOrder: number;
  isActive: boolean;
}

export type NewCoinPackage = Omit<CoinPackageRow, 'id' | 'sortOrder'>;

/** I/O boundary of coin packages. `credit` writes the purchase row and the `purchase` ledger row together or not at all. */
export interface CoinPackageStore {
  packages(opts?: { includeHidden?: boolean }): Promise<CoinPackageRow[]>;
  package(id: string): Promise<CoinPackageRow | null>;
  addPackage(p: NewCoinPackage): Promise<CoinPackageRow>;
  updatePackage(id: string, patch: Partial<NewCoinPackage> & { sortOrder?: number }): Promise<'ok' | 'not_found'>;
  credit(userId: string, pkg: CoinPackageRow, store: PurchaseStore, orderId: string): Promise<{ balance: number; duplicate: boolean }>;
}

export function createDbCoinPackageStore(db: Db): CoinPackageStore {
  const one = async (id: string) => (await db.select().from(coinPackages).where(eq(coinPackages.id, id)).limit(1))[0] ?? null;
  return {
    async packages(opts) {
      const rows = await db.select().from(coinPackages).orderBy(asc(coinPackages.sortOrder), asc(coinPackages.coins));
      return opts?.includeHidden ? rows : rows.filter((r) => r.isActive);
    },
    package: one,
    async addPackage(p) {
      const id = uuidv7();
      await db.insert(coinPackages).values({ id, ...p });
      return (await one(id))!;
    },
    async updatePackage(id, patch) {
      if (!(await one(id))) return 'not_found';
      if (Object.keys(patch).length > 0) await db.update(coinPackages).set(patch).where(eq(coinPackages.id, id));
      return 'ok';
    },
    credit: (userId, pkg, store, orderId) =>
      db.transaction(async (tx) => {
        const out = await applyLedgerEntry(tx, { userId, delta: pkg.coins, reason: 'purchase', refType: 'coin_package', refId: pkg.id, idempotencyKey: `purchase:${store}:${orderId}` });
        if (!out.applied) return { balance: out.balance, duplicate: true };
        await tx.insert(coinPurchases).values({ id: uuidv7(), userId, packageId: pkg.id, store, storeOrderId: orderId, coins: pkg.coins });
        return { balance: out.balance, duplicate: false };
      }),
  };
}

/** In-memory twin for tests; keeps the same "one order credits once" rule. */
export function createMemoryCoinPackageStore(): CoinPackageStore & { balances: Map<string, number> } {
  const rows: CoinPackageRow[] = [];
  const seen = new Set<string>();
  const balances = new Map<string, number>();
  return {
    balances,
    async packages(opts) {
      return rows.filter((r) => opts?.includeHidden || r.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.coins - b.coins);
    },
    async package(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async addPackage(p) {
      const row = { id: uuidv7(), sortOrder: rows.length, ...p };
      rows.push(row);
      return row;
    },
    async updatePackage(id, patch) {
      const row = rows.find((r) => r.id === id);
      if (!row) return 'not_found';
      Object.assign(row, patch);
      return 'ok';
    },
    async credit(userId, pkg, store, orderId) {
      const key = `${store}:${orderId}`;
      if (seen.has(key)) return { balance: balances.get(userId) ?? 0, duplicate: true };
      seen.add(key);
      const balance = (balances.get(userId) ?? 0) + pkg.coins;
      balances.set(userId, balance);
      return { balance, duplicate: false };
    },
  };
}
