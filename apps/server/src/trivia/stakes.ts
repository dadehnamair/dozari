import { triviaDuelAwards, triviaDuelNet } from '@dozari/shared';
import type { DuelReason, Stake } from '@dozari/shared';
import type { StakeStore } from '../duel/stakes-store.js';

export interface TriviaStakeDeps {
  /** Entry fee of a solo game / of each side of a duel (settings `trivia.solo_fee`, `trivia.duel_fee`); 0 = free. */
  soloFee(): Promise<number>;
  duelFee(): Promise<number>;
  /** House cut of a pot in percent (the board duel's `duel.house_cut_percent`). */
  houseCutPercent(): Promise<number>;
  isBot(userId: string): boolean;
}

/**
 * Coins of the question modes (docs/logic/trivia.md §Coins), through the same append-only ledger as the board duel. Every movement is one
 * idempotent row keyed by the game id, so a retry is a no-op. Reasons: `trivia_entry`, `trivia_payout`, `trivia_refund`.
 */
export class TriviaStakes {
  constructor(
    private readonly store: StakeStore,
    private readonly deps: TriviaStakeDeps,
  ) {}

  soloFee(): Promise<number> {
    return this.deps.soloFee();
  }

  duelFee(): Promise<number> {
    return this.deps.duelFee();
  }

  /** Can this player pay a solo game's fee right now? */
  async canAffordSolo(userId: string): Promise<boolean> {
    const fee = await this.deps.soloFee();
    return fee <= 0 || (await this.store.balance(userId)) >= fee;
  }

  async canAffordDuel(userId: string): Promise<boolean> {
    const fee = await this.deps.duelFee();
    return fee <= 0 || (await this.store.balance(userId)) >= fee;
  }

  /** Takes a solo game's fee; false when the player cannot pay. */
  async chargeSolo(sessionId: string, userId: string): Promise<boolean> {
    const fee = await this.deps.soloFee();
    if (fee <= 0) return true;
    return this.store.apply(userId, -fee, 'trivia_entry', sessionId, `trivia_entry:${sessionId}:${userId}`);
  }

  /** Gives a solo game's fee back (a good enough score); returns the coins refunded. */
  async refundSolo(sessionId: string, userId: string, fee: number): Promise<number> {
    if (fee <= 0) return 0;
    await this.store.apply(userId, fee, 'trivia_refund', sessionId, `trivia_refund:${sessionId}:${userId}`);
    return fee;
  }

  /** Takes each human seat's duel fee (a bot's is covered by the house). Not ok = the named player cannot pay; anything already taken is returned. */
  async openDuel(matchId: string, players: readonly [string, string]): Promise<{ ok: true; stakes: [Stake, Stake]; fee: number } | { ok: false; broke: string }> {
    const fee = await this.deps.duelFee();
    const stakes: Stake[] = [];
    const taken: string[] = [];
    for (const userId of players) {
      if (this.deps.isBot(userId)) {
        stakes.push('house');
        continue;
      }
      if (fee <= 0) {
        stakes.push('free');
        continue;
      }
      if (await this.store.apply(userId, -fee, 'trivia_entry', matchId, `trivia_entry:${matchId}:${userId}`)) {
        stakes.push('paid');
        taken.push(userId);
      } else {
        for (const u of taken) await this.store.apply(u, fee, 'trivia_refund', matchId, `trivia_refund:${matchId}:${u}:cancelled`);
        return { ok: false, broke: userId };
      }
    }
    return { ok: true, stakes: stakes as [Stake, Stake], fee };
  }

  /** The game could not start after the fees were taken: they come back in full. */
  async cancelDuel(matchId: string, players: readonly [string, string], stakes: readonly [Stake, Stake], fee: number): Promise<void> {
    for (const s of [0, 1] as const) if (stakes[s] === 'paid') await this.store.apply(players[s], fee, 'trivia_refund', matchId, `trivia_refund:${matchId}:${players[s]}:cancelled`);
  }

  /** Pays a finished duel and returns each side's net coin change. Safe to call twice (idempotent keys). */
  async settleDuel(matchId: string, players: readonly [string, string], stakes: readonly [Stake, Stake], fee: number, result: { winner: 0 | 1 | null; reason: DuelReason }): Promise<[number, number]> {
    const cut = await this.deps.houseCutPercent();
    const awards = triviaDuelAwards(fee, cut, stakes, result.winner, result.reason);
    for (const s of [0, 1] as const) {
      const a = awards[s];
      if (!a) continue;
      const reason = a.kind === 'payout' ? 'trivia_payout' : 'trivia_refund';
      await this.store.apply(players[s], a.coins, reason, matchId, `${reason}:${matchId}:${players[s]}`);
    }
    return triviaDuelNet(fee, cut, stakes, result.winner, result.reason);
  }
}
