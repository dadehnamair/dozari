export type Sfx = 'tap' | 'correct' | 'oneAway' | 'wrong' | 'win' | 'lose' | 'coin' | 'combo' | 'heartbeat';

/** [frequency Hz, start s, duration s] per note. Pure data so it can be tested. */
export const SFX_NOTES: Record<Sfx, readonly (readonly [number, number, number])[]> = {
  tap: [[660, 0, 0.05]],
  correct: [[523, 0, 0.09], [784, 0.09, 0.14]],
  oneAway: [[440, 0, 0.1], [440, 0.14, 0.1]],
  wrong: [[220, 0, 0.12], [165, 0.1, 0.18]],
  win: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.3]],
  lose: [[392, 0, 0.16], [330, 0.16, 0.16], [262, 0.32, 0.3]],
  coin: [[988, 0, 0.07], [1319, 0.07, 0.18]],
  /** Rising pair on top of `correct` when a combo grows. */
  combo: [[784, 0, 0.07], [988, 0.07, 0.07], [1319, 0.14, 0.18]],
  /** Two soft low thumps: lub-dub. */
  heartbeat: [[130, 0, 0.12], [110, 0.2, 0.16]],
};
