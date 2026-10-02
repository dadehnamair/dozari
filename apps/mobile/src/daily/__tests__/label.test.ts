import { describe, expect, it } from 'vitest';
import { dailyPuzzleLabel } from '../label';

const base = { dateKey: '2026-10-02', themeTitleFa: null, rewardCoins: 25, streak: 1 };
describe('dailyPuzzleLabel', () => {
  it('shows the reward before playing and the outcome after', () => {
    expect(dailyPuzzleLabel({ ...base, state: 'available' })).toContain('۲۵');
    expect(dailyPuzzleLabel({ ...base, state: 'won', themeTitleFa: 'نوروز' })).toContain('نوروز');
    expect(dailyPuzzleLabel({ ...base, state: 'lost' })).not.toBe(dailyPuzzleLabel({ ...base, state: 'won' }));
  });
});
