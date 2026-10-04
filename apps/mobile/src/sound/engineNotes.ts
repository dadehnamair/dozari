export type Sfx = 'tap' | 'press' | 'back' | 'select' | 'deselect' | 'confirm' | 'correct' | 'oneAway' | 'wrong' | 'win' | 'lose' | 'coin' | 'combo' | 'heartbeat';

/** [frequency Hz, start s, duration s] per note. Pure data so it can be tested. */
export const SFX_NOTES: Record<Sfx, readonly (readonly [number, number, number])[]> = {
  tap: [[660, 0, 0.05]],
  /** A normal button press: one short, soft tick. */
  press: [[560, 0, 0.045]],
  /** Back / close: a falling pair, so it reads as «going back». */
  back: [[520, 0, 0.05], [390, 0.05, 0.07]],
  /** A card picked on the board: bright and a little higher than a button. */
  select: [[740, 0, 0.04], [880, 0.035, 0.06]],
  /** A card put back. */
  deselect: [[500, 0, 0.05]],
  /** The main action (submit / go): a firm rising pair. */
  confirm: [[440, 0, 0.06], [660, 0.06, 0.1]],
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
