import { dailyDateKey, pickSlice } from '@dozari/shared';
import type { WheelPrize, WheelPrizeKind, WheelRules } from '@dozari/shared';

export interface WheelPrizeRow {
  id: string;
  kind: WheelPrizeKind;
  amount: number;
  weight: number;
  /** `cosmetic` slices: the shop item given. */
  itemId: string | null;
  /** Name and icon of that item (read from the shop, for the wheel face and the admin list). */
  titleFa?: string | null;
  iconKey?: string | null;
  sortOrder: number;
  isActive: boolean;
}
export type NewWheelPrize = Omit<WheelPrizeRow, 'id' | 'sortOrder' | 'titleFa' | 'iconKey'>;

export interface SpinResult {
  slice: number;
  kind: WheelPrizeKind;
  amount: number;
  pending: number;
  balance: number;
  gems: number;
  iconKey?: string | null;
  titleFa?: string;
  /** A cosmetic the player already owned: paid as `amount` coins instead (`kind` is then `coins`). */
  duplicate: boolean;
}

/** I/O boundary of the lucky wheel. */
export interface WheelStore {
  /** Records the spin a win earned; false when this match already gave one (a repeated settle). */
  grant(userId: string, matchId: string): Promise<boolean>;
  /** Gives `count` spins from `source` (`shop`, `level`, `tournament`, `daily`, `admin`); a repeated `ref` gives nothing again. Returns how many were added. */
  give(userId: string, source: string, ref: string, count: number): Promise<number>;
  pending(userId: string): Promise<number>;
  balance(userId: string): Promise<number>;
  gems(userId: string): Promise<number>;
  /** The live prize table (seeded from the shared default when empty); `includeHidden` adds switched-off slices for the admin. */
  prizes(opts?: { includeHidden?: boolean }): Promise<WheelPrizeRow[]>;
  addPrize(p: NewWheelPrize): Promise<WheelPrizeRow>;
  updatePrize(id: string, patch: Partial<NewWheelPrize> & { sortOrder?: number }): Promise<'ok' | 'not_found'>;
  /**
   * Atomically takes the player's oldest unspun spin, asks `roll` for the prize and pays it by kind (coins and gems through their
   * ledgers, hint tokens into the inventory, a spin as a new spin row). Null when nothing is waiting.
   */
  spin(userId: string, roll: () => { slice: number; itemId?: string } & WheelPrize, opts: { dupeCoins: number }): Promise<SpinResult | null>;
}

export interface WheelStatusView {
  enabled: boolean;
  /** Spins waiting, from every source. */
  pending: number;
  /** Spins this very request added (today's free spin), so the app can say «سهمیه‌ی امروز». */
  daily: number;
  slices: WheelPrize[];
  balance: number;
  gems: number;
}

/** The lucky wheel: a spin is earned only by winning a duel, and the server rolls the prize (rule 4). */
export class WheelService {
  /** Admin side of the prize table. */
  readonly prizes = {
    list: () => this.store.prizes({ includeHidden: true }),
    add: (p: NewWheelPrize) => this.store.addPrize(p),
    update: (id: string, patch: Partial<NewWheelPrize> & { sortOrder?: number }) => this.store.updatePrize(id, patch),
  };

  constructor(
    private readonly store: WheelStore,
    private readonly rules: () => Promise<WheelRules>,
    /** Uniform roll in [0, 1); injected so tests can fix the outcome. */
    private readonly random: () => number = Math.random,
    private readonly now: () => number = Date.now,
  ) {}

  /** Spins from outside a duel (a shop item, a level or tournament prize, the admin); never blocked by the wheel being off, so a bought spin is never lost. */
  async give(userId: string, source: string, ref: string, count: number): Promise<number> {
    return count > 0 ? this.store.give(userId, source, ref, count) : 0;
  }

  /** Called once for the winner of a finished duel that earns a spin. */
  async grantForWin(userId: string, matchId: string): Promise<boolean> {
    const rules = await this.rules();
    if (!rules.enabled || rules.winSpins === false) return false;
    return this.store.grant(userId, matchId);
  }

  async status(userId: string): Promise<WheelStatusView> {
    const rules = await this.rules();
    // The free daily spin is handed out the first time the player looks at the wheel that day.
    const daily = rules.enabled && (rules.dailySpins ?? 0) > 0 ? await this.store.give(userId, 'daily', dailyDateKey(this.now()), rules.dailySpins ?? 0) : 0;
    const [pending, balance, gems] = await Promise.all([this.store.pending(userId), this.store.balance(userId), this.store.gems(userId)]);
    return { enabled: rules.enabled, pending: rules.enabled ? pending : 0, daily, slices: rules.slices.map((s) => ({ kind: s.kind, amount: s.amount, iconKey: s.iconKey ?? null, titleFa: s.titleFa })), balance, gems };
  }

  /** Spins the oldest waiting spin; null when none is waiting (or the wheel is off). */
  async spin(userId: string) {
    const rules = await this.rules();
    if (!rules.enabled) return null;
    return this.store.spin(userId, () => {
      const slice = pickSlice(rules.slices, this.random());
      const s = rules.slices[slice]!;
      return { slice, kind: s.kind, amount: s.amount, itemId: s.itemId, iconKey: s.iconKey, titleFa: s.titleFa };
    }, { dupeCoins: rules.dupeCoins ?? 0 });
  }
}
