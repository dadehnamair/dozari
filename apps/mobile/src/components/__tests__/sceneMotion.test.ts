import { describe, expect, it } from 'vitest';
import { across, phase } from '../sceneMath';

describe('scene motion math', () => {
  it('loops 0..1 and a negative begin starts part-way', () => {
    expect(phase(0, 10)).toBe(0);
    expect(phase(5, 10)).toBe(0.5);
    expect(phase(12, 10)).toBeCloseTo(0.2);
    expect(phase(0, 70, -35)).toBe(0.5);
    expect(phase(-3, 10)).toBeCloseTo(0.7);
  });
  it('walks through keyframes linearly and returns to the first value', () => {
    const v = [20, 24, 20];
    expect(across(v, 0)).toBe(20);
    expect(across(v, 0.25)).toBe(22);
    expect(across(v, 0.5)).toBe(24);
    expect(across(v, 1)).toBe(20);
  });
});
