import { dailyDateKey, pickSlice } from '@dozari/shared';
import type { WheelRules } from '@dozari/shared';

/** I/O boundary of the lucky wheel. */
export interface WheelStore {
  /** Records the spin a win earned; false when this match already gave one (a repeated settle). */
  grant(userId: string, matchId: string): Promise<boolean>;
  /** Gives `count` spins from `source` (`shop`, `level`, `tournament`, `daily`, `admin`); a repeated `ref` gives nothing again. Returns how many were added. */
  give(userId: string, source: string, ref: string, count: number): Promise<number>;
  pending(userId: string): Promise<number>;
  balance(userId: string): Promise<number>;
  /**
   * Atomically takes the player's oldest unspun spin, asks `roll` for the prize and credits it through the ledger.
   * Null when nothing is waiting.
   */
  spin(userId: string, roll: () => { slice: number; coins: number }): Promise<{ slice: number; coins: number; pending: number; balance: number } | null>;
}

export interface WheelStatusView {
  enabled: boolean;
  /** Spins waiting, from every source. */
  pending: number;
  /** Spins this very request added (today's free spin), so the app can say «سهمیه‌ی امروز». */
  daily: number;
  slices: number[];
  balance: number;
}

/** The lucky wheel: a spin is earned only by winning a duel, and the server rolls the prize (rule 4). */
export class WheelService {
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
    if (!(await this.rules()).enabled) return false;
    return this.store.grant(userId, matchId);
  }

  async status(userId: string): Promise<WheelStatusView> {
    const rules = await this.rules();
    // The free daily spin is handed out the first time the player looks at the wheel that day.
    const daily = rules.enabled && (rules.dailySpins ?? 0) > 0 ? await this.store.give(userId, 'daily', dailyDateKey(this.now()), rules.dailySpins ?? 0) : 0;
    const [pending, balance] = await Promise.all([this.store.pending(userId), this.store.balance(userId)]);
    return { enabled: rules.enabled, pending: rules.enabled ? pending : 0, daily, slices: rules.slices.map((s) => s.coins), balance };
  }

  /** Spins the oldest waiting spin; null when none is waiting (or the wheel is off). */
  async spin(userId: string) {
    const rules = await this.rules();
    if (!rules.enabled) return null;
    return this.store.spin(userId, () => {
      const slice = pickSlice(rules.slices, this.random());
      return { slice, coins: rules.slices[slice]!.coins };
    });
  }
}
