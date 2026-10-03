import { WHEEL_SLICES_DEFAULT } from '../config/economy.js';
import type { DuelReason, Stake } from './duel.js';

/** The lucky wheel (docs/logic/economy.md §Lucky wheel): a chance that only a won duel earns. Pure; the server rolls and pays. */

export interface WheelSlice {
  coins: number;
  /** Relative odds; a slice with weight 0 never wins. */
  weight: number;
}

export interface WheelRules {
  enabled: boolean;
  slices: readonly WheelSlice[];
  /** Free spins every player gets once a day (0 / absent = none). */
  dailySpins?: number;
}

export const DEFAULT_WHEEL_RULES: WheelRules = { enabled: true, slices: WHEEL_SLICES_DEFAULT };

/** The default slices with every prize scaled by `percent` (rounded, at least 1 coin). */
export function scaleSlices(slices: readonly WheelSlice[], percent: number): WheelSlice[] {
  return slices.map((s) => ({ weight: s.weight, coins: Math.max(1, Math.round((s.coins * percent) / 100)) }));
}

/**
 * Does this finished duel earn the winner a spin? Only a real win against a human: no draw, no loss, no abandon or forfeit
 * (an opponent who leaves is the easy way to farm), and no win against a bot (a house seat).
 */
export function earnsWheelSpin(result: { winner: 0 | 1 | null; reason: DuelReason }, stakes: readonly [Stake, Stake]): boolean {
  if (result.winner === null) return false;
  if (result.reason !== 'solved' && result.reason !== 'locked_out') return false;
  return stakes[0] !== 'house' && stakes[1] !== 'house';
}

/** Index of the winning slice for `roll` in [0, 1). */
export function pickSlice(slices: readonly WheelSlice[], roll: number): number {
  const total = slices.reduce((n, s) => n + Math.max(0, s.weight), 0);
  if (total <= 0) return 0;
  let at = Math.min(Math.max(roll, 0), 0.999999999) * total;
  for (let i = 0; i < slices.length; i++) {
    at -= Math.max(0, slices[i]!.weight);
    if (at < 0) return i;
  }
  return slices.length - 1;
}

/** Average coins of one spin (for the balance simulation and the admin hint). */
export function wheelExpectedCoins(slices: readonly WheelSlice[]): number {
  const total = slices.reduce((n, s) => n + Math.max(0, s.weight), 0);
  return total <= 0 ? 0 : slices.reduce((n, s) => n + s.coins * Math.max(0, s.weight), 0) / total;
}
