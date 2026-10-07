import { TABLE_HOUSE_CUT_PERCENT, settleTable } from '@dozari/shared';
import type { StakeStore } from '../duel/stakes-store.js';

/**
 * Coins of a private table's match: every seated player pays the table's entry fee when the match starts, the winning side splits the
 * pot after the house cut, a draw returns every fee. Every movement is one idempotent ledger row (reasons `match_entry`,
 * `match_payout`, `match_refund`, the same ones live duels use).
 */
export class TableStakes {
  constructor(
    private readonly store: StakeStore,
    private readonly cutPercent: () => Promise<number> | number = () => TABLE_HOUSE_CUT_PERCENT,
  ) {}

  balance(userId: string): Promise<number> {
    return this.store.balance(userId);
  }

  /** Takes the fee from every player; false (and everything already taken is returned) when one cannot pay. */
  async open(matchId: string, players: readonly string[], fee: number): Promise<boolean> {
    const taken: string[] = [];
    for (const u of players) {
      if (await this.store.apply(u, -fee, 'match_entry', matchId, `match_entry:${matchId}:${u}`)) taken.push(u);
      else {
        await this.cancel(matchId, taken, fee);
        return false;
      }
    }
    return true;
  }

  /** The match never started: every fee comes back in full. */
  async cancel(matchId: string, players: readonly string[], fee: number): Promise<void> {
    for (const u of players) await this.store.apply(u, fee, 'match_refund', matchId, `match_refund:${matchId}:${u}:cancelled`);
  }

  /** Pays a finished match: the winning side splits the pot, a draw refunds. Safe to call twice. */
  async settle(matchId: string, sides: readonly [readonly string[], readonly string[]], fee: number, result: { winner: 0 | 1 | null }): Promise<void> {
    const award = settleTable(fee, [sides[0].length, sides[1].length], result.winner, await this.cutPercent());
    if (award.kind === 'none') return;
    const reason = award.kind === 'payout' ? 'match_payout' : 'match_refund';
    for (const side of [0, 1] as const) {
      const coins = award.perPlayer[side];
      if (coins <= 0) continue;
      for (const u of sides[side]) await this.store.apply(u, coins, reason, matchId, `${reason}:${matchId}:${u}`);
    }
  }
}
