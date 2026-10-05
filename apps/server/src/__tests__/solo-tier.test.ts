import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
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

describe('offline pack', () => {
  const make = (n: number): ServedPuzzle => ({ ...puzzle, id: `pz${n}` });
  it('gives distinct whole puzzles fit for the player level, up to the count asked', async () => {
    const asked: (number | undefined)[] = [];
    let k = 0;
    const src: PuzzleSource = { pickRandom: async (o) => (asked.push(o?.level), make(k++ % 3)), pricesFor: async () => ({}) };
    const solo = new SoloService(src, { levelOf: async () => 2 });
    const pack = (await solo.offlinePack('u1', 3))!;
    expect(pack.puzzles.map((p) => p.id).sort()).toEqual(['pz0', 'pz1', 'pz2']);
    expect(asked.every((l) => l === 2)).toBe(true);
    expect(pack.puzzles[0]!.groups).toHaveLength(4);
    expect(pack.puzzles[0]!.groups[0]).toMatchObject({ titleFa: 'عنوان 0', productIds: expect.any(Array) });
  });

  it('gives fewer when the pool is small and nothing when it is empty', async () => {
    const one = new SoloService({ pickRandom: async () => make(1), pricesFor: async () => ({}) });
    expect((await one.offlinePack('u1', 5))?.puzzles).toHaveLength(1);
    const none = new SoloService({ pickRandom: async () => null, pricesFor: async () => ({}) });
    expect(await none.offlinePack('u1', 5)).toEqual({ puzzles: [] });
  });

  it('stops handing out puzzles once the account has used its daily allowance, and starts again the next day', async () => {
    let k = 0;
    const clock = { ms: 1_000 };
    const solo = new SoloService({ pickRandom: async () => make(k++), pricesFor: async () => ({}) }, { now: () => clock.ms });
    const got: number[] = [];
    for (let i = 0; i < 6; i++) got.push((await solo.offlinePack('u1', 5))?.puzzles.length ?? -1);
    expect(got).toEqual([5, 5, 5, -1, -1, -1]); // 15 in all
    expect(await solo.offlinePack('someone-else', 5)).not.toBeNull();
    clock.ms += 25 * 60 * 60 * 1000;
    expect((await solo.offlinePack('u1', 5))?.puzzles).toHaveLength(5);
  });

  it('is for signed-in players only', async () => {
    const app = buildServer({ solo: new SoloService({ pickRandom: async () => make(1), pricesFor: async () => ({}) }) });
    expect((await app.inject({ method: 'GET', url: '/solo/offline-pack' })).statusCode).toBe(401);
  });
});
