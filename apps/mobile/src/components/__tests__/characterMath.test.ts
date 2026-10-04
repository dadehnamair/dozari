import { describe, expect, it } from 'vitest';
import { alternate, backArmAngle, blinkScale, bobLift, bobRotate, breathScale, coinFlip, frontArmAngle, keyframes } from '../characterMath';

describe('character keyframes', () => {
  it('hits the design keyframes exactly', () => {
    expect([bobRotate(0), bobRotate(0.25), bobRotate(0.75), bobRotate(1)]).toEqual([0, -3, 3, 0]);
    expect([bobLift(0.5), bobLift(0)]).toEqual([-2.5, 0]);
    expect([blinkScale(0), blinkScale(0.9), blinkScale(1)]).toEqual([1, 1, 1]);
    expect(blinkScale(0.94)).toBeCloseTo(0.08);
    expect([coinFlip(0.7), coinFlip(0.8), coinFlip(0.9)]).toEqual([1, -1, 1]);
    expect(breathScale(0)).toEqual([1, 1]);
    expect(breathScale(0.5)[0]).toBeCloseTo(1.025);
    expect(breathScale(0.5)[1]).toBeCloseTo(0.985);
  });

  it('eases between keyframes and stays inside their range', () => {
    expect(keyframes([[0, 0], [1, 10]], 0.5)).toBeCloseTo(5);
    expect(keyframes([[0, 0], [1, 10]], 0.25)).toBeLessThan(2.5);
    for (let p = 0; p <= 1; p += 0.01) {
      expect(Math.abs(bobRotate(p))).toBeLessThanOrEqual(3);
      expect(blinkScale(p)).toBeGreaterThanOrEqual(0.08);
    }
  });

  it('arms alternate between rest and the swing angle, faster when raised', () => {
    expect(frontArmAngle(0, false)).toBeCloseTo(0);
    expect(frontArmAngle(1.3, false)).toBeCloseTo(-9);
    expect(frontArmAngle(2.6, false)).toBeCloseTo(0);
    expect(backArmAngle(0.5, true)).toBeCloseTo(7);
    expect(alternate(0.45, 0.45)).toBeCloseTo(1);
    expect(alternate(-0.45, 0.45)).toBeCloseTo(1);
  });
});
