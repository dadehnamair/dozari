import type { SubmitOutcome } from './solo.js';

/** The solo combo: groups solved back to back, each within the window of the previous one (D178). Cosmetic, client-side. */
export interface ComboState {
  /** Groups solved in a row without a slip or a timeout. */
  streak: number;
  /** Epoch ms after which the streak is lost; null while there is none. */
  deadline: number | null;
}

export const NO_COMBO: ComboState = { streak: 0, deadline: null };

/** The state after a submission: a correct group extends (or starts) the streak, a wrong / one-away guess breaks it, a repeat changes nothing. */
export function comboAfter(state: ComboState, outcome: SubmitOutcome, now: number, windowMs: number): ComboState {
  switch (outcome) {
    case 'correct': {
      const alive = state.deadline !== null && now <= state.deadline;
      return { streak: alive ? state.streak + 1 : 1, deadline: now + windowMs };
    }
    case 'wrong':
    case 'one_away':
      return NO_COMBO;
    case 'duplicate':
    case 'invalid':
      return state;
  }
}

/** The streak as the player should see it: lost once the deadline passed. */
export function comboStreak(state: ComboState, now: number): number {
  return state.deadline !== null && now <= state.deadline ? state.streak : 0;
}

/** Share of the window still left, 1 (just solved) down to 0 (lost). */
export function comboLeft(state: ComboState, now: number, windowMs: number): number {
  if (state.deadline === null) return 0;
  return Math.min(1, Math.max(0, (state.deadline - now) / windowMs));
}

/** The final chance: exactly one mistake left while the game is still on. */
export const isLastLife = (mistakes: number, max: number, playing: boolean): boolean => playing && max - mistakes === 1;
