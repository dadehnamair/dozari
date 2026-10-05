/** Pure money math of the per-round coin wager of a duel's price-guess round (docs/logic/price-guess-round.md §Real coin side-bet). */

/** How a seat enters a round: put its wager down (`in`), is a bot whose wager the house covers (`house`), or cannot afford it and sits the round out (`out`). */
export type WagerSeat = 'in' | 'house' | 'out';
export type RoundVerdict = 'a' | 'b' | 'draw';

/**
 * Coins to credit each human seat once the round is revealed (their wager was already debited when the round opened).
 * Both seats in play: the winner takes the pot minus the house cut, a draw refunds each wager minus the cut, a bot never collects.
 * With fewer than two seats in play nobody has anyone to bet against, so every wager put down comes back in full.
 */
export function settleWager(amount: number, houseCutPercent: number, seats: readonly [WagerSeat, WagerSeat], verdict: RoundVerdict): [number, number] {
  const credit: [number, number] = [0, 0];
  const inPlay = seats.filter((s) => s !== 'out').length;
  if (inPlay < 2) {
    for (const i of [0, 1] as const) if (seats[i] === 'in') credit[i] = amount;
    return credit;
  }
  const keep = (100 - houseCutPercent) / 100;
  if (verdict === 'draw') {
    for (const i of [0, 1] as const) if (seats[i] === 'in') credit[i] = Math.floor(amount * keep);
    return credit;
  }
  const w = verdict === 'a' ? 0 : 1;
  if (seats[w] === 'in') credit[w] = Math.floor(amount * 2 * keep);
  return credit;
}
