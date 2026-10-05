/** Pure money math of a live duel (docs/logic/economy.md). The server applies the amounts through the ledger. */

export interface DuelRules {
  /** Entry fee each player stakes; the pot is twice this. */
  entryFee: number;
  houseCutPercent: number;
  freePerDay: number;
  /** Percent of the normal payout a free-match win pays (from the house pot). */
  freePayoutPercent: number;
  consolation: number;
  /** Most consolation coins one player can collect per Tehran day. */
  consolationCap: number;
  /** A broke player with no free matches is topped up to this once a day. */
  rescueTarget: number;
}

/** How a seat entered: paid its fee, played a daily free match, or is a bot whose fee the house covers. */
export type Stake = 'paid' | 'free' | 'house';

export type Award = { kind: 'payout' | 'refund' | 'consolation'; coins: number };

export type DuelReason = 'solved' | 'locked_out' | 'forfeit' | 'abandon';

export const potOf = (rules: DuelRules): number => rules.entryFee * 2;

export const winnerPayout = (rules: DuelRules): number => Math.floor((potOf(rules) * (100 - rules.houseCutPercent)) / 100);

export const drawRefund = (rules: DuelRules): number => Math.floor((rules.entryFee * (100 - rules.houseCutPercent)) / 100);

/** Coins to add so a player who cannot pay reaches the rescue target; 0 when they can already pay. */
export const rescueAmount = (balance: number, rules: DuelRules): number => (balance >= rules.entryFee ? 0 : Math.max(0, rules.rescueTarget - balance));

/**
 * What each seat is paid when a duel ends. `consolationLeft` is how much consolation each human may still collect today.
 * A win pays the pot minus the house cut; a free-match win pays a share of that. A draw refunds a paid fee minus the cut.
 * A loser gets the small consolation only from a full match (not when they abandoned or forfeited).
 */
export function settleDuel(rules: DuelRules, stakes: readonly [Stake, Stake], winner: 0 | 1 | null, reason: DuelReason, consolationLeft: readonly [number, number]): [Award | null, Award | null] {
  const out: [Award | null, Award | null] = [null, null];
  if (winner === null) {
    for (const s of [0, 1] as const) if (stakes[s] === 'paid') out[s] = { kind: 'refund', coins: drawRefund(rules) };
    return out;
  }
  const full = winnerPayout(rules);
  const coins = stakes[winner] === 'house' ? 0 : stakes[winner] === 'free' ? Math.floor((full * rules.freePayoutPercent) / 100) : full;
  if (coins > 0) out[winner] = { kind: 'payout', coins };
  const loser = (1 - winner) as 0 | 1;
  if (reason !== 'abandon' && reason !== 'forfeit' && stakes[loser] !== 'house') {
    const c = Math.min(rules.consolation, Math.max(0, consolationLeft[loser]));
    if (c > 0) out[loser] = { kind: 'consolation', coins: c };
  }
  return out;
}

/** One stake table of the live queue (docs/logic/economy-v2.md §Sinks, D204). Bronze is the original fee table. */
export interface DuelTier {
  id: 'bronze' | 'silver' | 'gold';
  fee: number;
  minLevel: number;
}
export const DUEL_TIER_IDS = ['bronze', 'silver', 'gold'] as const;

/** Builds the tables on offer from settings: a table with a fee of 0 is off, bronze (the base fee) is always the first. */
export function duelTiers(v: { bronzeFee: number; bronzeMinLevel: number; silverFee: number; silverMinLevel: number; goldFee: number; goldMinLevel: number }): DuelTier[] {
  const all: DuelTier[] = [
    { id: 'bronze', fee: v.bronzeFee, minLevel: v.bronzeMinLevel },
    { id: 'silver', fee: v.silverFee, minLevel: v.silverMinLevel },
    { id: 'gold', fee: v.goldFee, minLevel: v.goldMinLevel },
  ];
  return all.filter((t, i) => i === 0 || t.fee > 0);
}
