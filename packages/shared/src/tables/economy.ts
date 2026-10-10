import { TABLE_ENTRY_MAX, TABLE_ENTRY_PER_ROUND, TABLE_HOUSE_CUT_PERCENT, TABLE_ROUNDS_MAX, TABLE_ROUNDS_MIN } from '../config/tables.js';

/** Rounds clamped into the allowed range (a non-integer reads as the minimum). */
export const clampTableRounds = (rounds: number): number => (Number.isInteger(rounds) ? Math.min(TABLE_ROUNDS_MAX, Math.max(TABLE_ROUNDS_MIN, rounds)) : TABLE_ROUNDS_MIN);

/** The lowest entry fee a table of `rounds` rounds may ask: it grows with the rounds. */
export const tableMinEntry = (rounds: number): number => clampTableRounds(rounds) * TABLE_ENTRY_PER_ROUND;

/** Is `fee` a legal entry for `rounds` rounds? Zero is legal only where coins do not move (kid and teen tables). */
export const tableEntryOk = (fee: number, rounds: number, coinsAllowed: boolean): boolean => (coinsAllowed ? Number.isInteger(fee) && fee >= tableMinEntry(rounds) && fee <= TABLE_ENTRY_MAX : fee === 0);

export interface TableAward {
  /** Coins paid to each player of the side (0 = nothing). */
  perPlayer: [number, number];
  kind: 'payout' | 'refund' | 'none';
}

/**
 * What each side's players get back when a table match ends. The pot is every player's fee: the winning side splits it after the house
 * cut (rounded down per player); a draw returns every fee in full. A fee of 0 moves nothing.
 */
export function settleTable(fee: number, sideSizes: readonly [number, number], winner: 0 | 1 | null, cutPercent: number = TABLE_HOUSE_CUT_PERCENT): TableAward {
  if (fee <= 0) return { perPlayer: [0, 0], kind: 'none' };
  if (winner === null) return { perPlayer: [fee, fee], kind: 'refund' };
  const pot = fee * (sideSizes[0] + sideSizes[1]);
  const prize = Math.floor((pot * (100 - Math.min(100, Math.max(0, cutPercent)))) / 100);
  const each = Math.floor(prize / Math.max(1, sideSizes[winner]));
  return { perPlayer: winner === 0 ? [each, 0] : [0, each], kind: 'payout' };
}
