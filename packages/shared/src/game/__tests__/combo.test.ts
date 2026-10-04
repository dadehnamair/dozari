import { describe, expect, it } from 'vitest';
import { comboAfter, comboLeft, comboStreak, isLastLife, NO_COMBO } from '../combo.js';

const W = 25_000;

describe('solo combo', () => {
  it('starts at 1 on the first correct group and grows while each comes inside the window', () => {
    const a = comboAfter(NO_COMBO, 'correct', 1_000, W);
    expect(a.streak).toBe(1);
    const b = comboAfter(a, 'correct', 1_000 + W, W);
    expect(b.streak).toBe(2);
    expect(comboAfter(b, 'correct', b.deadline! - 1, W).streak).toBe(3);
  });

  it('restarts at 1 when the window ran out', () => {
    const a = comboAfter(NO_COMBO, 'correct', 0, W);
    expect(comboAfter(a, 'correct', W + 1, W).streak).toBe(1);
  });

  it('is lost on a wrong or one-away guess, untouched by a repeat or an invalid pick', () => {
    const a = comboAfter(comboAfter(NO_COMBO, 'correct', 0, W), 'correct', 10, W);
    expect(comboAfter(a, 'wrong', 20, W)).toEqual(NO_COMBO);
    expect(comboAfter(a, 'one_away', 20, W)).toEqual(NO_COMBO);
    expect(comboAfter(a, 'duplicate', 20, W)).toBe(a);
    expect(comboAfter(a, 'invalid', 20, W)).toBe(a);
  });

  it('shows the streak only while alive and reports the share of window left', () => {
    const a = comboAfter(NO_COMBO, 'correct', 0, W);
    expect(comboStreak(a, 1)).toBe(1);
    expect(comboStreak(a, W + 1)).toBe(0);
    expect(comboLeft(a, 0, W)).toBe(1);
    expect(comboLeft(a, W / 2, W)).toBeCloseTo(0.5);
    expect(comboLeft(a, W * 2, W)).toBe(0);
    expect(comboLeft(NO_COMBO, 0, W)).toBe(0);
  });

  it('knows the last life', () => {
    expect(isLastLife(3, 4, true)).toBe(true);
    expect(isLastLife(2, 4, true)).toBe(false);
    expect(isLastLife(4, 4, true)).toBe(false);
    expect(isLastLife(3, 4, false)).toBe(false);
  });
});
