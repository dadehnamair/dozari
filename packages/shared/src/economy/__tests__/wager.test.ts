import { describe, expect, it } from 'vitest';
import { settleWager } from '../wager.js';

describe('price-round wager', () => {
  it('pays the round winner the pot minus the house cut', () => {
    expect(settleWager(5, 10, ['in', 'in'], 'a')).toEqual([9, 0]);
    expect(settleWager(5, 10, ['in', 'in'], 'b')).toEqual([0, 9]);
    expect(settleWager(5, 0, ['in', 'in'], 'a')).toEqual([10, 0]);
  });
  it('refunds each wager minus the cut on a draw', () => {
    expect(settleWager(5, 10, ['in', 'in'], 'draw')).toEqual([4, 4]);
  });
  it('a bot seat never collects, and the house covers its wager', () => {
    expect(settleWager(5, 10, ['in', 'house'], 'a')).toEqual([9, 0]);
    expect(settleWager(5, 10, ['in', 'house'], 'b')).toEqual([0, 0]);
    expect(settleWager(5, 10, ['house', 'in'], 'draw')).toEqual([0, 4]);
  });
  it('a side that sits out leaves the other with nobody to bet against: the wager comes back in full', () => {
    expect(settleWager(5, 10, ['in', 'out'], 'a')).toEqual([5, 0]);
    expect(settleWager(5, 10, ['out', 'in'], 'b')).toEqual([0, 5]);
    expect(settleWager(5, 10, ['out', 'out'], 'draw')).toEqual([0, 0]);
  });
  it('never creates coins: a paid-out pot is at most the wagers put down plus the house wager', () => {
    for (const amount of [2, 3, 4, 5, 7]) for (const cut of [0, 10, 25]) {
      const [x, y] = settleWager(amount, cut, ['in', 'in'], 'a');
      expect(x + y).toBeLessThanOrEqual(amount * 2);
    }
  });
});
