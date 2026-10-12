/** Scheduled tournament rounds (D225, docs/logic/tournaments.md §Scheduled rounds). Pure: the server and the app share the same clock maths. */

const MIN_MS = 60_000;

/** When round `round` (1-based) opens: round 1 at the tournament's start, then one `gapMinutes` later each. 0 gap = legacy back-to-back rounds (no schedule). */
export const roundOpensAt = (startsAt: number, gapMinutes: number, round: number): number => startsAt + Math.max(0, round - 1) * gapMinutes * MIN_MS;

/** The check-in window of a match that opens at `opensAt`: players show up between `opensAt` and `deadline`. */
export const matchDeadline = (opensAt: number, graceMinutes: number): number => opensAt + graceMinutes * MIN_MS;

/** Where a player's next match stands: waiting for its time, open for check-in, checked in (waiting for the rival), or being played. */
export type TurnState = 'upcoming' | 'open' | 'checked_in' | 'playing';

export function turnState(input: { now: number; opensAt: number; playing: boolean; checkedIn: boolean }): TurnState {
  if (input.playing) return 'playing';
  if (input.now < input.opensAt) return 'upcoming';
  return input.checkedIn ? 'checked_in' : 'open';
}

/** What the deadline decides when it passes with the match not started: the one who showed up wins; nobody showed = the better seed goes on. */
export function forfeitOutcome(aIn: boolean, bIn: boolean): 'a' | 'b' | 'seed' | 'play' {
  if (aIn && bIn) return 'play';
  if (aIn) return 'a';
  if (bIn) return 'b';
  return 'seed';
}
