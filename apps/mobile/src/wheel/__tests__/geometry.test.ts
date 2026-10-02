import { describe, expect, it } from 'vitest';
import { spinAngle } from '../geometry';

describe('spinAngle', () => {
  it('stops slice 0 on the pointer after whole turns', () => {
    expect(spinAngle(0, 8)).toBe(1800);
  });
  it('turns back by the slice offset so the chosen slice reaches the top', () => {
    expect(spinAngle(2, 8)).toBe(1800 - 90);
    expect((spinAngle(3, 8) + 3 * 45) % 360).toBe(0);
  });
});
