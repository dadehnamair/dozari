import { dailyDateKey, earnsWheelSpin, rescueAmount, settleDuel, tehranDayStart } from '@dozari/shared';
import type { DuelReason, DuelRules, Stake } from '@dozari/shared';
import type { StakeStore } from './stakes-store.js';

export interface StakeDeps {
  rules(): Promise<DuelRules>;
  isBot(userId: string): boolean;
  /** Coins each side puts on every round of the price-guess round (setting `duel.price_wager`); 0 or absent = no wager. */
  priceWager?(): Promise<number>;
  /** The winner of a duel that earns a lucky-wheel spin (a real win against a human). */
  onWin?(matchId: string, userId: string): Promise<unknown>;
  now?: () => number;
}

/**
 * Coins of a live queue duel: free matches, the entry fee, the payout / refund / consolation, and the once-a-day rescue of a
 * broke player (docs/logic/economy.md). Friendly matches (private tables, tournaments) never come here.
 */
export class DuelStakes {
  constructor(
    private readonly store: StakeStore,
    private readonly deps: StakeDeps,
  ) {}

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  /** May this player queue? A broke player with no free match left is topped up once a day. */
  async canQueue(userId: string): Promise<boolean> {
    const rules = await this.deps.rules();
    if (rules.entryFee <= 0) return true;
    const day = dailyDateKey(this.now());
    if ((await this.store.freeUsed(userId, day)) < rules.freePerDay) return true;
    const balance = await this.store.balance(userId);
    if (balance >= rules.entryFee) return true;
    const top = rescueAmount(balance, rules);
    if (top <= 0) return false;
    const since = tehranDayStart(this.now());
    if ((await this.store.creditedSince(userId, 'broke_rescue', since)).rows > 0) return false;
    return this.store.apply(userId, top, 'broke_rescue', null, `broke_rescue:${userId}:${day}`);
  }

  /** Takes each seat's stake (free match or fee). Null when a human cannot pay; anything already taken is returned. */
  async open(matchId: string, players: readonly [string, string]): Promise<[Stake, Stake] | null> {
    const rules = await this.deps.rules();
    const day = dailyDateKey(this.now());
    const stakes: Stake[] = [];
    const taken: string[] = [];
    for (const userId of players) {
      if (this.deps.isBot(userId)) {
        stakes.push('house');
        continue;
      }
      if (rules.entryFee <= 0) {
        stakes.push('free');
        continue;
      }
      if ((await this.store.freeUsed(userId, day)) < rules.freePerDay) {
        await this.store.bumpFree(userId, day);
        stakes.push('free');
        continue;
      }
      if (await this.store.apply(userId, -rules.entryFee, 'match_entry', matchId, `match_entry:${matchId}:${userId}`)) {
        stakes.push('paid');
        taken.push(userId);
      } else {
        for (const u of taken) await this.store.apply(u, rules.entryFee, 'match_refund', matchId, `match_refund:${matchId}:${u}:cancelled`);
        return null;
      }
    }
    return stakes as [Stake, Stake];
  }

  /** The match could not start after the stakes were taken: paid fees come back in full, a used free match is not restored. */
  async cancel(matchId: string, players: readonly [string, string], stakes: readonly [Stake, Stake]): Promise<void> {
    const rules = await this.deps.rules();
    for (const s of [0, 1] as const) if (stakes[s] === 'paid') await this.store.apply(players[s], rules.entryFee, 'match_refund', matchId, `match_refund:${matchId}:${players[s]}:cancelled`);
  }

  /** The per-round wager of the price-guess round and the house cut, or null when there is no wager. */
  async wagerRules(): Promise<{ amount: number; cutPercent: number; isBot: (userId: string) => boolean } | null> {
    const amount = (await this.deps.priceWager?.()) ?? 0;
    if (amount <= 0) return null;
    return { amount, cutPercent: (await this.deps.rules()).houseCutPercent, isBot: (id) => this.deps.isBot(id) };
  }

  /** Puts a player's wager for one round down; false when they cannot afford it (they sit the round out). */
  takeWager(matchId: string, round: number, userId: string, amount: number): Promise<boolean> {
    return this.store.apply(userId, -amount, 'price_guess_wager', matchId, `price_guess_wager:${matchId}:${round}:${userId}`);
  }

  /** Gives coins back after a round: the winner's pot, a draw's refund, or a wager returned in full. Idempotent. */
  async creditWager(matchId: string, round: number, userId: string, coins: number): Promise<void> {
    if (coins > 0) await this.store.apply(userId, coins, 'price_guess_payout', matchId, `price_guess_payout:${matchId}:${round}:${userId}`);
  }

  /** Pays out a finished duel. Safe to call twice (idempotent keys). */
  async settle(matchId: string, players: readonly [string, string], stakes: readonly [Stake, Stake], result: { winner: 0 | 1 | null; reason: DuelReason }): Promise<void> {
    const rules = await this.deps.rules();
    const since = tehranDayStart(this.now());
    const left: [number, number] = [0, 0];
    for (const s of [0, 1] as const) left[s] = stakes[s] === 'house' ? 0 : Math.max(0, rules.consolationCap - (await this.store.creditedSince(players[s], 'match_consolation', since)).total);
    const awards = settleDuel(rules, stakes, result.winner, result.reason, left);
    for (const s of [0, 1] as const) {
      const a = awards[s];
      if (!a) continue;
      const reason = a.kind === 'payout' ? 'match_payout' : a.kind === 'refund' ? 'match_refund' : 'match_consolation';
      await this.store.apply(players[s], a.coins, reason, matchId, `${reason}:${matchId}:${players[s]}`);
    }
    if (result.winner !== null && earnsWheelSpin(result, stakes)) await this.deps.onWin?.(matchId, players[result.winner]);
  }
}
