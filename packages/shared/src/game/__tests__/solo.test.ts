import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, GROUP_SIZE, SOLO_MAX_MISTAKES } from '../../config/index.js';
import { mulberry32, shuffled } from '../rng.js';
import { selectionKey, shuffleBoard, startSolo, submitGuess } from '../solo.js';
import type { GroupLevel, SoloPuzzle, SoloState } from '../solo.js';

const puzzle: SoloPuzzle = {
  groups: ([0, 1, 2, 3] as GroupLevel[]).map((level) => ({
    level,
    productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`),
  })),
};
const ids = (level: number) => puzzle.groups[level]!.productIds;
const start = (seed = 1) => startSolo(puzzle, mulberry32(seed));

describe('rng', () => {
  it('is deterministic per seed and stays in [0,1)', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const xs = Array.from({ length: 50 }, () => a());
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()));
    expect(xs).not.toEqual(Array.from({ length: 50 }, () => c()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('shuffled keeps the same elements without mutating the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffled(input, mulberry32(7));
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('startSolo', () => {
  it('puts all 16 products on the board and never lays out a row as a whole group', () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = start(seed);
      expect(s.remaining).toHaveLength(BOARD_SIZE);
      for (let row = 0; row < 4; row++) {
        const key = selectionKey(s.remaining.slice(row * 4, row * 4 + 4));
        expect(puzzle.groups.some((g) => selectionKey(g.productIds) === key)).toBe(false);
      }
    }
  });

  it('is reproducible from the seed and rejects malformed puzzles', () => {
    expect(start(5).remaining).toEqual(start(5).remaining);
    expect(() => startSolo({ groups: puzzle.groups.slice(0, 3) }, mulberry32(1))).toThrow();
  });
});

describe('submitGuess', () => {
  it('solves a group and takes its cards off the board', () => {
    const r = submitGuess(start(), puzzle, ids(1));
    expect(r.outcome).toBe('correct');
    expect(r.solvedLevel).toBe(1);
    expect(r.state.remaining).toHaveLength(12);
    expect(r.state.solved).toEqual([{ level: 1, productIds: ids(1), revealed: false }]);
    expect(r.state.mistakes).toBe(0);
  });

  it('reports one away (3 of a group + 1 stranger) as a mistake', () => {
    const r = submitGuess(start(), puzzle, [...ids(0).slice(0, 3), ids(1)[0]!]);
    expect(r.outcome).toBe('one_away');
    expect(r.state.mistakes).toBe(1);
  });

  it('reports 2+2 as wrong', () => {
    const r = submitGuess(start(), puzzle, [...ids(0).slice(0, 2), ...ids(1).slice(0, 2)]);
    expect(r.outcome).toBe('wrong');
    expect(r.state.mistakes).toBe(1);
  });

  it('rejects a repeated set without penalty, in any order', () => {
    const bad = [...ids(0).slice(0, 2), ...ids(1).slice(0, 2)];
    const first = submitGuess(start(), puzzle, bad);
    const again = submitGuess(first.state, puzzle, [...bad].reverse());
    expect(again.outcome).toBe('duplicate');
    expect(again.state).toBe(first.state);
  });

  it('ignores malformed selections', () => {
    const s = start();
    for (const sel of [ids(0).slice(0, 3), [...ids(0), ids(1)[0]!], [ids(0)[0]!, ids(0)[0]!, ids(0)[1]!, ids(0)[2]!], ['nope', ...ids(0).slice(0, 3)]]) {
      const r = submitGuess(s, puzzle, sel);
      expect(r.outcome).toBe('invalid');
      expect(r.state).toBe(s);
    }
  });

  it('auto-reveals the last group after three are solved and wins', () => {
    let s = start();
    for (const level of [3, 0, 2]) s = submitGuess(s, puzzle, ids(level)).state;
    expect(s.status).toBe('won');
    expect(s.remaining).toHaveLength(0);
    expect(s.solved.map((g) => g.revealed)).toEqual([false, false, false, true]);
    expect(s.solved[3]?.level).toBe(1);
    expect(submitGuess(s, puzzle, ids(1)).outcome).toBe('invalid');
  });

  it('loses on the 4th mistake and reveals everything left, still counting solved groups', () => {
    let s = submitGuess(start(), puzzle, ids(2)).state;
    const wrongs = [
      [ids(0)[0]!, ids(0)[1]!, ids(1)[0]!, ids(1)[1]!],
      [ids(0)[0]!, ids(0)[2]!, ids(1)[0]!, ids(1)[2]!],
      [ids(0)[0]!, ids(0)[3]!, ids(1)[0]!, ids(1)[3]!],
      [ids(0)[1]!, ids(0)[2]!, ids(1)[1]!, ids(1)[2]!],
    ];
    for (let i = 0; i < SOLO_MAX_MISTAKES; i++) {
      expect(s.status).toBe('playing');
      s = submitGuess(s, puzzle, wrongs[i]!).state;
    }
    expect(s.status).toBe('lost');
    expect(s.mistakes).toBe(SOLO_MAX_MISTAKES);
    expect(s.remaining).toHaveLength(0);
    expect(s.solved.filter((g) => g.revealed).map((g) => g.level).sort()).toEqual([0, 1, 3]);
  });
});

describe('shuffleBoard', () => {
  it('only reorders the remaining cards', () => {
    const s = submitGuess(start(), puzzle, ids(3)).state;
    const t = shuffleBoard(s, mulberry32(99));
    expect([...t.remaining].sort()).toEqual([...s.remaining].sort());
    expect({ ...t, remaining: s.remaining }).toEqual(s);
  });
});

describe('properties', () => {
  const allIds = puzzle.groups.flatMap((g) => g.productIds);
  const pick4 = fc.shuffledSubarray(allIds, { minLength: 4, maxLength: 4 });

  it('whatever the player does, the state stays consistent', () => {
    fc.assert(
      fc.property(fc.integer(), fc.array(fc.oneof(pick4, fc.constantFrom(...puzzle.groups.map((g) => [...g.productIds]))), { maxLength: 40 }), (seed, guesses) => {
        let s: SoloState = startSolo(puzzle, mulberry32(seed));
        for (const g of guesses) {
          const before = s;
          const r = submitGuess(s, puzzle, g);
          s = r.state;
          // every product is exactly once on the board or in a solved group
          const placed = [...s.remaining, ...s.solved.flatMap((x) => x.productIds)];
          expect(placed).toHaveLength(BOARD_SIZE);
          expect(new Set(placed).size).toBe(BOARD_SIZE);
          expect(s.mistakes).toBeLessThanOrEqual(SOLO_MAX_MISTAKES);
          expect(s.mistakes).toBeGreaterThanOrEqual(before.mistakes);
          if (r.outcome === 'correct') expect(s.mistakes).toBe(before.mistakes);
          if (r.outcome === 'one_away' || r.outcome === 'wrong') expect(s.mistakes).toBe(before.mistakes + 1);
          if (r.outcome === 'duplicate' || r.outcome === 'invalid') expect(s).toBe(before);
          // terminal states are final
          if (before.status !== 'playing') expect(s).toBe(before);
          expect(s.status === 'playing').toBe(s.remaining.length > 0);
          if (s.status === 'won') expect(s.mistakes).toBeLessThan(SOLO_MAX_MISTAKES);
          if (s.status === 'lost') expect(s.mistakes).toBe(SOLO_MAX_MISTAKES);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('a player who knows the answer always wins with no mistakes, in any order', () => {
    fc.assert(
      fc.property(fc.integer(), fc.shuffledSubarray([0, 1, 2, 3], { minLength: 4, maxLength: 4 }), (seed, order) => {
        let s = startSolo(puzzle, mulberry32(seed));
        for (const level of order) s = submitGuess(s, puzzle, ids(level)).state;
        expect(s.status).toBe('won');
        expect(s.mistakes).toBe(0);
        expect(s.solved).toHaveLength(GROUP_SIZE);
      }),
    );
  });
});
