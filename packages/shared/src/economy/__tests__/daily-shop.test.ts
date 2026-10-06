import { describe, expect, it } from 'vitest';
import { pickDailyShop } from '../daily-shop.js';

const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

describe('pickDailyShop', () => {
  it('is the same for one day, whatever the pool order', () => {
    const one = pickDailyShop(pool, '2026-10-05', 4);
    expect(one).toHaveLength(4);
    expect(pickDailyShop([...pool].reverse(), '2026-10-05', 4).sort()).toEqual([...one].sort());
  });
  it('keeps the pool order and changes with the day', () => {
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'].map((d) => pickDailyShop(pool, d, 4).join(''));
    for (const d of days) expect([...d]).toEqual([...d].sort());
    expect(new Set(days).size).toBeGreaterThan(1);
  });
  it('offers everything when the pool is small or slots is 0', () => {
    expect(pickDailyShop(['x', 'y'], '2026-10-05', 4)).toEqual(['x', 'y']);
    expect(pickDailyShop(pool, '2026-10-05', 0)).toEqual(pool);
  });
});
