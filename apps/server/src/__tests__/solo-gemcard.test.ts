import { describe, expect, it } from 'vitest';
import { SoloService } from '../solo/service.js';
import type { PuzzleSource, ServedPuzzle } from '../solo/types.js';

const puzzle: ServedPuzzle = {
  id: 'pz1',
  groups: ([0, 1, 2, 3] as const).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`), titleFa: `t${level}`, explanationFa: `e${level}` })),
  items: Object.fromEntries([0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].map((i) => [`g${l}p${i}`, { nameFa: `کالا ${l}-${i}`, unitFa: null }]))),
};
const src: PuzzleSource = { pickRandom: async () => puzzle, pricesFor: async () => ({}) };

function setup(percent: number) {
  const paid: { userId: string; amount: number; key: string }[] = [];
  const solo = new SoloService(src, { newSeed: () => 7, gemCard: async () => ({ percent, amount: 2 }), onGem: (userId, amount, key) => paid.push({ userId, amount, key }) });
  return { solo, paid };
}

/** Solves every group; returns the gems reported with each correct guess. */
async function playAll(solo: SoloService, userId?: string) {
  const view = (await solo.start(userId))!;
  const gems: (number | undefined)[] = [];
  for (const g of puzzle.groups) gems.push(solo.guess(view.sessionId, g.productIds as string[])!.gem);
  return gems;
}

describe('solo gem card', () => {
  it('pays exactly once, on the group that holds the card', async () => {
    const { solo, paid } = setup(100);
    const gems = await playAll(solo, 'u1');
    expect(gems.filter(Boolean)).toEqual([2]);
    expect(paid).toHaveLength(1);
    expect(paid[0]).toMatchObject({ userId: 'u1', amount: 2 });
    expect(paid[0]!.key).toMatch(/^gem_card:.+:u1$/);
  });

  it('hides no gem at 0 percent, for guests, or from the view', async () => {
    const zero = setup(0);
    expect((await playAll(zero.solo, 'u1')).filter(Boolean)).toEqual([]);
    const guest = setup(100);
    expect((await playAll(guest.solo)).filter(Boolean)).toEqual([]);
    expect(guest.paid).toEqual([]);
    const full = setup(100);
    const view = (await full.solo.start('u1'))!;
    expect(JSON.stringify(view)).not.toMatch(/gem/i);
  });
});
