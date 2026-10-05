import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../game/rng.js';
import { soloOfflinePackSchema, soloViewSchema } from '../contract.js';
import type { SoloOfflinePuzzle } from '../contract.js';
import { localGuess, localShuffle, localView, startLocalSolo } from '../local.js';

const puzzle: SoloOfflinePuzzle = {
  id: 'pz1',
  groups: ([0, 1, 2, 3] as const).map((level) => ({ level, titleFa: `عنوان ${level}`, explanationFa: `توضیح ${level}`, productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`) })),
  items: Object.fromEntries([0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].map((i) => [`g${l}p${i}`, { nameFa: `کالا ${l}-${i}`, unitFa: null, iconKey: null }]))),
};
const ids = (l: number) => puzzle.groups[l]!.productIds as string[];
const start = () => startLocalSolo(puzzle, mulberry32(5), 'local-1');

describe('local solo', () => {
  it('starts with 16 cards, no solved rows, and a view the screen can parse', () => {
    const view = localView(start());
    expect(view.cards).toHaveLength(16);
    expect(view.solved).toEqual([]);
    expect(soloViewSchema.parse(view)).toEqual(view);
  });

  it('solves a group, auto-reveals the last one after three, and wins', () => {
    let s = start();
    for (const l of [0, 1, 2]) {
      const out = localGuess(s, ids(l));
      expect(out.result.outcome).toBe('correct');
      s = out.session;
    }
    const view = localView(s);
    expect(view.status).toBe('won');
    expect(view.solved).toHaveLength(4);
    expect(view.solved[3]).toMatchObject({ revealed: true, titleFa: 'عنوان 3' });
  });

  it('counts a wrong guess, calls a near miss, and loses after the mistake limit with every group shown', () => {
    let s = start();
    const near = localGuess(s, [...ids(0).slice(0, 3), ids(1)[0]!]);
    expect(near.result.outcome).toBe('one_away');
    s = near.session;
    const wrongs = [[ids(0)[0]!, ids(1)[0]!, ids(2)[0]!, ids(3)[0]!], [ids(0)[1]!, ids(1)[1]!, ids(2)[1]!, ids(3)[1]!], [ids(0)[2]!, ids(1)[2]!, ids(2)[2]!, ids(3)[2]!]];
    for (const w of wrongs) s = localGuess(s, w).session;
    const view = localView(s);
    expect(view.status).toBe('lost');
    expect(view.mistakes).toBe(view.maxMistakes);
    expect(view.solved).toHaveLength(4);
  });

  it('rejects a repeated set without a penalty, and a shuffle only reorders', () => {
    let s = start();
    s = localGuess(s, [ids(0)[0]!, ids(1)[0]!, ids(2)[0]!, ids(3)[0]!]).session;
    const before = localView(s).mistakes;
    const dup = localGuess(s, [ids(0)[0]!, ids(1)[0]!, ids(2)[0]!, ids(3)[0]!]);
    expect(dup.result.outcome).toBe('duplicate');
    expect(localView(dup.session).mistakes).toBe(before);
    const shuffled = localShuffle(s, mulberry32(9));
    expect([...localView(shuffled).cards.map((c) => c.id)].sort()).toEqual([...localView(s).cards.map((c) => c.id)].sort());
  });
});

describe('offline pack contract', () => {
  it('accepts whole puzzles and rejects one with a short group', () => {
    expect(soloOfflinePackSchema.parse({ puzzles: [puzzle] }).puzzles).toHaveLength(1);
    const bad = { puzzles: [{ ...puzzle, groups: [{ ...puzzle.groups[0]!, productIds: ['a'] }, ...puzzle.groups.slice(1)] }] };
    expect(soloOfflinePackSchema.safeParse(bad).success).toBe(false);
  });
});
