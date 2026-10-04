import { describe, expect, it } from 'vitest';
import { SoloService } from '../solo/service.js';
import type { PuzzleSource, ServedPuzzle } from '../solo/types.js';

const puzzle: ServedPuzzle = {
  id: 'pz1',
  groups: ([0, 1, 2, 3] as const).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`), titleFa: `عنوان ${level}`, explanationFa: `توضیح ${level}` })),
  items: Object.fromEntries([0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].map((i) => [`g${l}p${i}`, { nameFa: `کالا ${l}-${i}`, unitFa: null }]))),
};

describe('solo puzzle tier', () => {
  it('asks the source for a puzzle fit for the signed-in player level', async () => {
    const asked: (number | undefined)[] = [];
    const src: PuzzleSource = { pickRandom: async (o) => (asked.push(o?.level), puzzle), pricesFor: async () => ({}) };
    const solo = new SoloService(src, { levelOf: async (id) => (id === 'newbie' ? 1 : 30) });
    await solo.start('newbie');
    await solo.start('veteran');
    await solo.start(); // a guest has no level: any puzzle
    expect(asked).toEqual([1, 30, undefined]);
  });

  it('still starts when the level lookup fails', async () => {
    const src: PuzzleSource = { pickRandom: async () => puzzle, pricesFor: async () => ({}) };
    const solo = new SoloService(src, { levelOf: async () => Promise.reject(new Error('down')) });
    expect(await solo.start('someone')).not.toBeNull();
  });
});
