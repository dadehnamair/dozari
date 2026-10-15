import { settleDuel } from '../economy/duel.js';
import type { Award, DuelReason, DuelRules, Stake } from '../economy/duel.js';

/** Pure coin math of the question modes (docs/logic/trivia.md §Coins). The server applies the amounts through the ledger. */

/** A solo game "passes" (fee given back, counted as a win for XP) when at least `percent` of the answers are right. 0 = always. */
export function triviaSoloPassed(score: number, total: number, percent: number): boolean {
  return total > 0 && score * 100 >= percent * total;
}

/** The duel rules of a question duel: only the entry fee and the house cut apply — no free matches, consolation or rescue. */
export function triviaDuelRules(fee: number, houseCutPercent: number): DuelRules {
  return { entryFee: fee, houseCutPercent, freePerDay: 0, freePayoutPercent: 100, consolation: 0, consolationCap: 0, rescueTarget: 0 };
}

/** What each seat is paid when a question duel ends (winner: pot minus cut; draw: fee minus cut; forfeit: the leaver loses the fee). */
export function triviaDuelAwards(fee: number, houseCutPercent: number, stakes: readonly [Stake, Stake], winner: 0 | 1 | null, reason: DuelReason): [Award | null, Award | null] {
  return settleDuel(triviaDuelRules(fee, houseCutPercent), stakes, winner, reason, [0, 0]);
}

/** Net coin change of each seat over the whole game (what was paid in is subtracted). */
export function triviaDuelNet(fee: number, houseCutPercent: number, stakes: readonly [Stake, Stake], winner: 0 | 1 | null, reason: DuelReason): [number, number] {
  const awards = triviaDuelAwards(fee, houseCutPercent, stakes, winner, reason);
  return [0, 1].map((s) => (awards[s as 0 | 1]?.coins ?? 0) - (stakes[s as 0 | 1] === 'paid' ? fee : 0)) as [number, number];
}

/** One revealed question seen by one side, for the live score line, the streak and the "who got it" banner. */
export interface RevealedForView {
  correctIndex: number;
  yourPick: number | null;
  opponentPick: number | null;
}
export type RevealKind = 'both' | 'you' | 'rival' | 'none';

export function revealKind(r: RevealedForView): RevealKind {
  const you = r.yourPick === r.correctIndex;
  const rival = r.opponentPick === r.correctIndex;
  return you && rival ? 'both' : you ? 'you' : rival ? 'rival' : 'none';
}

/** Right answers of each side so far, `[you, rival]`. */
export function revealScores(rows: readonly RevealedForView[]): [number, number] {
  let a = 0;
  let b = 0;
  for (const r of rows) {
    if (r.yourPick === r.correctIndex) a += 1;
    if (r.opponentPick === r.correctIndex) b += 1;
  }
  return [a, b];
}

/** Right answers in a row ending at the newest question (0 when the newest was wrong). */
export function yourStreak(rows: readonly RevealedForView[]): number {
  let n = 0;
  for (let i = rows.length - 1; i >= 0 && rows[i]!.yourPick === rows[i]!.correctIndex; i--) n += 1;
  return n;
}
