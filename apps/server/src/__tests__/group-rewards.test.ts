import { describe, expect, it, vi } from 'vitest';
import { groupRewardFor } from '@dozari/shared';
import { GroupScoreRecorder } from '../groupgame/record.js';
import type { GroupGameStore } from '../groupgame/store.js';

describe('groupRewardFor', () => {
  it('turns a day of points into whole coins and xp, each capped', () => {
    expect(groupRewardFor(0)).toEqual({ coins: 0, xp: 0 });
    expect(groupRewardFor(4)).toEqual({ coins: 0, xp: 4 });
    expect(groupRewardFor(70)).toEqual({ coins: 14, xp: 70 });
    expect(groupRewardFor(10_000)).toEqual({ coins: 20, xp: 80 });
  });
});

const delta = { userRef: '5', name: 'سارا', points: 15, groups: 1, wrong: 0 };

function setup(over: Partial<ConstructorParameters<typeof GroupScoreRecorder>[0]> = {}) {
  const addScore = vi.fn(async () => undefined);
  const credit = vi.fn(async () => ({ coins: 3, xp: 15 }));
  const onPaid = vi.fn();
  const rec = new GroupScoreRecorder({ store: { addScore } as unknown as GroupGameStore, userOf: async (r) => (r === '5' ? 'u1' : null), rewards: { credit }, onPaid, ...over });
  return { rec, addScore, credit, onPaid };
}

describe('GroupScoreRecorder', () => {
  it('attaches the account to the tally and pays it', async () => {
    const t = setup();
    await t.rec.record('c', '2026-10-17', '2026-10-20', delta);
    expect(t.addScore).toHaveBeenCalledWith('c', '2026-10-17', expect.objectContaining({ userId: 'u1' }));
    expect(t.credit).toHaveBeenCalledWith('u1', '2026-10-20', 15);
    expect(t.onPaid).toHaveBeenCalledWith('u1');
  });

  it('pays nobody who is not linked, scored nothing, or not eligible, but always keeps the tally', async () => {
    const t = setup();
    await t.rec.record('c', 'w', 'd', { ...delta, userRef: '9' });
    await t.rec.record('c', 'w', 'd', { ...delta, points: 0 });
    expect(t.credit).not.toHaveBeenCalled();
    expect(t.addScore).toHaveBeenCalledTimes(2);
    const kid = setup({ eligible: async () => false });
    await kid.rec.record('c', 'w', 'd', delta);
    expect(kid.credit).not.toHaveBeenCalled();
    expect(kid.addScore).toHaveBeenCalledTimes(1);
  });

  it('never lets a failed payment break scoring', async () => {
    const log = vi.fn();
    const t = setup({ rewards: { credit: async () => { throw new Error('db'); } }, log });
    await expect(t.rec.record('c', 'w', 'd', delta)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
  });
});
