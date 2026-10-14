import { describe, expect, it } from 'vitest';
import { coinDelta, lastSeenBalance, rememberBalance, resetSeenBalance } from '../coinDelta';

describe('coinDelta', () => {
  it('is 0 on the first draw', () => expect(coinDelta(null, 120)).toBe(0));
  it('is positive after a win and negative after a loss', () => {
    expect(coinDelta(100, 150)).toBe(50);
    expect(coinDelta(100, 80)).toBe(-20);
  });
  it('remembers the last drawn balance', () => {
    resetSeenBalance();
    expect(lastSeenBalance()).toBeNull();
    rememberBalance(40);
    expect(lastSeenBalance()).toBe(40);
  });
});
