import { describe, expect, it } from 'vitest';
import { DEFAULT_WHEEL_RULES, earnsWheelSpin, pickSlice, scaleSlices, wheelExpectedCoins } from '../wheel.js';

describe('lucky wheel', () => {
  it('earns a spin only from a real win against a human', () => {
    expect(earnsWheelSpin({ winner: 0, reason: 'solved' }, ['paid', 'paid'])).toBe(true);
    expect(earnsWheelSpin({ winner: 1, reason: 'locked_out' }, ['free', 'paid'])).toBe(true);
    expect(earnsWheelSpin({ winner: null, reason: 'solved' }, ['paid', 'paid'])).toBe(false); // draw
    expect(earnsWheelSpin({ winner: 0, reason: 'forfeit' }, ['paid', 'paid'])).toBe(false);
    expect(earnsWheelSpin({ winner: 0, reason: 'abandon' }, ['paid', 'paid'])).toBe(false);
    expect(earnsWheelSpin({ winner: 0, reason: 'solved' }, ['paid', 'house'])).toBe(false); // bot opponent
  });
  it('picks slices by weight and never a zero-weight one', () => {
    const slices = [{ coins: 5, weight: 1 }, { coins: 9, weight: 0 }, { coins: 20, weight: 3 }];
    expect(pickSlice(slices, 0)).toBe(0);
    expect(pickSlice(slices, 0.24)).toBe(0);
    expect(pickSlice(slices, 0.26)).toBe(2);
    expect(pickSlice(slices, 0.9999)).toBe(2);
  });
  it('scales prizes and reports the expected value', () => {
    expect(scaleSlices([{ coins: 5, weight: 1 }], 50)[0]!.coins).toBe(3);
    expect(scaleSlices([{ coins: 5, weight: 1 }], 0)[0]!.coins).toBe(1);
    expect(wheelExpectedCoins(DEFAULT_WHEEL_RULES.slices)).toBeGreaterThan(5);
  });
});
