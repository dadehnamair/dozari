import { describe, expect, it } from 'vitest';
import { TABLE_ENTRY_MAX, TABLE_ROUNDS_MAX, TABLE_ROUNDS_MIN } from '../../config/tables.js';
import { clampTableRounds, settleTable, tableEntryOk, tableMinEntry } from '../economy.js';

describe('table rounds and entry', () => {
  it('the minimum entry grows with the rounds', () => {
    const mins = [1, 2, 3].map(tableMinEntry);
    expect(mins[0]).toBeGreaterThan(0);
    expect(mins[1]).toBeGreaterThan(mins[0]!);
    expect(mins[2]).toBeGreaterThan(mins[1]!);
  });
  it('clamps rounds into range', () => {
    expect(clampTableRounds(0)).toBe(TABLE_ROUNDS_MIN);
    expect(clampTableRounds(99)).toBe(TABLE_ROUNDS_MAX);
    expect(clampTableRounds(1.5)).toBe(TABLE_ROUNDS_MIN);
  });
  it('accepts an entry between the minimum and the cap; free only where coins do not move', () => {
    expect(tableEntryOk(tableMinEntry(2), 2, true)).toBe(true);
    expect(tableEntryOk(tableMinEntry(2) - 1, 2, true)).toBe(false);
    expect(tableEntryOk(TABLE_ENTRY_MAX + 1, 1, true)).toBe(false);
    expect(tableEntryOk(0, 1, true)).toBe(false);
    expect(tableEntryOk(0, 1, false)).toBe(true);
    expect(tableEntryOk(10, 1, false)).toBe(false);
  });
});

describe('settleTable', () => {
  it('a 1v1 winner takes the pot minus the house cut', () => {
    expect(settleTable(20, [1, 1], 0, 10)).toEqual({ perPlayer: [36, 0], kind: 'payout' });
  });
  it('a 2v2 winning side splits it, rounding down', () => {
    expect(settleTable(25, [2, 2], 1, 10)).toEqual({ perPlayer: [0, 45], kind: 'payout' });
  });
  it('a draw returns every fee, a free table moves nothing', () => {
    expect(settleTable(20, [2, 2], null)).toEqual({ perPlayer: [20, 20], kind: 'refund' });
    expect(settleTable(0, [1, 1], 0)).toEqual({ perPlayer: [0, 0], kind: 'none' });
  });
});
