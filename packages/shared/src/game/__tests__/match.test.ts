import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, FIRST_BLOOD_BONUS, GROUP_POINTS, MATCH_MAX_MISTAKES, TURN_SECONDS } from '../../config/index.js';
import { applyCommand, finalScores, matchClientView, resolveWinner, startMatch, turnDeadline } from '../match.js';
import type { Command, MatchEvent, MatchSide, MatchState } from '../match.js';
import { mulberry32 } from '../rng.js';
import type { GroupLevel, SoloPuzzle } from '../solo.js';

const puzzle: SoloPuzzle = {
  groups: ([0, 1, 2, 3] as GroupLevel[]).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`) })),
};
const ids = (level: number) => puzzle.groups[level]!.productIds as string[];
const U = ['u0', 'u1'] as const;
const start = (side: MatchSide = 0, now = 1000) => startMatch(puzzle, U, mulberry32(1), now, side);

function ok(state: MatchState, cmd: Command, now = 2000): { state: MatchState; events: MatchEvent[] } {
  const r = applyCommand(state, cmd, { now });
  if ('error' in r) throw new Error(`unexpected ${r.error}`);
  return r;
}
const submit = (state: MatchState, side: MatchSide, itemIds: string[], now = 2000) => ok(state, { t: 'submit', by: U[side], itemIds }, now);

/** Distinct sets taking 2+2 from groups 0 and 1: never correct, never one away. */
const wrongSets: string[][] = [];
for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) for (let c = 0; c < 4; c++) for (let d = c + 1; d < 4; d++) {
  wrongSets.push([`g0p${a}`, `g0p${b}`, `g1p${c}`, `g1p${d}`]);
}
const err = (state: MatchState, cmd: Command) => {
  const r = applyCommand(state, cmd, { now: 2000 });
  return 'error' in r ? r.error : null;
};

describe('startMatch', () => {
  it('lays out 16 cards, gives side 0 the first turn when asked, and rejects a single player twice', () => {
    const s = start(0);
    expect(s.remaining).toHaveLength(BOARD_SIZE);
    expect([s.turn, s.turnId, s.status, s.result]).toEqual([0, 1, 'playing', null]);
    expect(turnDeadline(s)).toBe(1000 + TURN_SECONDS * 1000);
    expect(() => startMatch(puzzle, ['a', 'a'], mulberry32(1), 0)).toThrow();
  });

  it('picks the starting side from the rng when not forced', () => {
    const sides = new Set(Array.from({ length: 40 }, (_, seed) => startMatch(puzzle, U, mulberry32(seed), 0).turn));
    expect(sides).toEqual(new Set([0, 1]));
  });
});

describe('submit rules', () => {
  it('only the active side may submit', () => {
    expect(err(start(0), { t: 'submit', by: 'u1', itemIds: ids(0) })).toBe('NOT_YOUR_TURN');
    expect(err(start(0), { t: 'submit', by: 'ghost', itemIds: ids(0) })).toBe('UNKNOWN_PLAYER');
  });

  it('rejects selections that are not 4 distinct cards on the board', () => {
    const s = start(0);
    for (const itemIds of [ids(0).slice(0, 3), [...ids(0).slice(0, 3), ids(0)[0]!], [...ids(0).slice(0, 3), 'nope'], [...ids(0), ids(1)[0]!]]) {
      expect(err(s, { t: 'submit', by: 'u0', itemIds })).toBe('INVALID_SELECTION');
    }
  });

  it('rejects a repeated set (any order, either side) without penalty', () => {
    const wrong = wrongSets[0]!;
    const after = submit(start(0), 0, wrong).state;
    expect(err(after, { t: 'submit', by: 'u1', itemIds: [...wrong].reverse() })).toBe('DUPLICATE_SELECTION');
    expect(after.mistakes).toEqual([1, 0]);
  });

  it('a correct group scores its points plus first blood, keeps the turn and restarts the clock', () => {
    const r = submit(start(0), 0, ids(2), 5000);
    expect(r.state.scores).toEqual([GROUP_POINTS[2] + FIRST_BLOOD_BONUS, 0]);
    expect([r.state.turn, r.state.turnId, r.state.turnStartedAt]).toEqual([0, 2, 5000]);
    expect(r.state.remaining).toHaveLength(12);
    expect(r.events).toContainEqual({ t: 'group_solved', side: 0, level: 2, points: GROUP_POINTS[2] + FIRST_BLOOD_BONUS, firstBlood: true });
    const second = submit(r.state, 0, ids(0));
    expect(second.state.scores[0]).toBe(GROUP_POINTS[2] + FIRST_BLOOD_BONUS + GROUP_POINTS[0]);
  });

  it('a wrong guess costs a mistake and passes the turn; one away is flagged', () => {
    const wrong = submit(start(0), 0, wrongSets[0]!);
    expect(wrong.state.mistakes).toEqual([1, 0]);
    expect(wrong.state.turn).toBe(1);
    expect(wrong.events).toContainEqual({ t: 'guess', side: 0, itemIds: wrongSets[0], outcome: 'wrong' });
    const oneAway = submit(start(0), 0, [...ids(0).slice(0, 3), ids(1)[0]!]);
    expect(oneAway.events).toContainEqual({ t: 'guess', side: 0, itemIds: [...ids(0).slice(0, 3), ids(1)[0]!], outcome: 'one_away' });
    expect(oneAway.state.mistakes).toEqual([1, 0]);
  });
});

describe('lock-out', () => {
  /** Alternate wrong guesses until side 0 has made `n` mistakes (side 1 has n-1) and it is side 1's move or the match ended. */
  function wrongRounds(n: number): MatchState {
    let s = start(0);
    let k = 0;
    for (let i = 0; i < n; i++) {
      s = submit(s, 0, wrongSets[k++]!).state;
      if (s.status === 'finished' || i === n - 1) break;
      s = submit(s, 1, wrongSets[k++]!).state;
    }
    return s;
  }

  it('a side at the mistake limit is locked out and the other keeps the turn', () => {
    const s = wrongRounds(MATCH_MAX_MISTAKES);
    expect(s.lockedOut).toEqual([true, false]);
    expect(s.turn).toBe(1);
    expect(s.status).toBe('playing');
    // side 1 now plays alone: a correct group, then a timeout, both leave the turn with side 1
    const solved = submit(s, 1, ids(3));
    expect(solved.state.turn).toBe(1);
    const timedOut = ok(solved.state, { t: 'timeout', turnId: solved.state.turnId });
    expect(timedOut.state.turn).toBe(1);
    expect(timedOut.state.turnId).toBe(solved.state.turnId + 1);
  });

  it('both sides locked out ends the match and reveals the rest', () => {
    const s = submit(wrongRounds(MATCH_MAX_MISTAKES), 1, wrongSets[7]!).state;
    expect(s.lockedOut).toEqual([true, true]);
    expect(s.status).toBe('finished');
    expect(s.result?.reason).toBe('locked_out');
    expect(s.solved).toHaveLength(4);
    expect(s.solved.every((g) => g.by === null)).toBe(true);
  });
});

describe('timeouts', () => {
  it('ignores a stale timer', () => {
    const s = start(0);
    const r = ok(s, { t: 'timeout', turnId: 99 });
    expect(r.state).toBe(s);
    expect(r.events).toEqual([]);
  });

  it('passes the turn without a mistake', () => {
    const r = ok(start(0), { t: 'timeout', turnId: 1 }, 7000);
    expect(r.state.turn).toBe(1);
    expect(r.state.mistakes).toEqual([0, 0]);
    expect(r.state.timeouts).toEqual([1, 0]);
    expect([r.state.turnId, r.state.turnStartedAt]).toEqual([2, 7000]);
  });

  it('two timeouts in a row make a side forfeit, but a submit in between resets the count', () => {
    let s = ok(start(0), { t: 'timeout', turnId: 1 }).state; // side 0 times out
    s = submit(s, 1, wrongSets[0]!).state; // side 1 plays, turn back to 0
    const forfeited = ok(s, { t: 'timeout', turnId: s.turnId }).state;
    expect(forfeited.status).toBe('finished');
    expect(forfeited.result).toEqual({ winner: 1, reason: 'forfeit' });

    let t = ok(start(0), { t: 'timeout', turnId: 1 }).state;
    t = submit(t, 1, wrongSets[0]!).state;
    t = submit(t, 0, wrongSets[1]!).state; // side 0 submits: counter resets
    expect(t.timeouts[0]).toBe(0);
  });
});

describe('leaving and forfeiting', () => {
  it('leave is an abandon and the opponent wins regardless of score', () => {
    const lead = submit(start(0), 0, ids(3)).state;
    const r = ok(lead, { t: 'leave', by: 'u0' });
    expect(r.state.result).toEqual({ winner: 1, reason: 'abandon' });
    expect(r.state.scores).toEqual([GROUP_POINTS[3] + FIRST_BLOOD_BONUS, 0]);
    expect(err(start(0), { t: 'leave', by: 'ghost' })).toBe('UNKNOWN_PLAYER');
  });

  it('forfeit gives the win to the other side and a finished match accepts nothing', () => {
    const r = ok(start(1), { t: 'forfeit', side: 1 });
    expect(r.state.result).toEqual({ winner: 0, reason: 'forfeit' });
    for (const cmd of [{ t: 'submit', by: 'u0', itemIds: ids(0) }, { t: 'timeout', turnId: 1 }, { t: 'leave', by: 'u0' }, { t: 'forfeit', side: 0 }] as Command[]) {
      expect(err(r.state, cmd)).toBe('MATCH_FINISHED');
    }
  });
});

describe('end of puzzle and tie-breaks', () => {
  it('the 4th group is auto-revealed after the 3rd is solved; higher score wins', () => {
    let s = submit(start(0), 0, ids(3), 1100).state; // 4 + 1
    s = submit(s, 0, ids(2), 1200).state; // +3
    const r = submit(s, 0, ids(1), 1300); // +2 -> 3 solved
    expect(r.state.status).toBe('finished');
    expect(r.state.result).toEqual({ winner: 0, reason: 'solved' });
    expect(r.state.solved.map((g) => [g.level, g.by])).toEqual([[3, 0], [2, 0], [1, 0], [0, null]]);
    expect(r.events.at(-1)).toEqual({ t: 'finished', result: { winner: 0, reason: 'solved' } });
  });

  /** Side 0 takes L3 (first blood, 5), side 1 takes L1+L2 (2+3 = 5): equal scores. */
  function tied(mistakes0: number, mistakes1: number, t0: number, t1: number): MatchState {
    let s = submit(start(0), 0, ids(3), t0).state;
    let k = 0;
    // pad mistakes: side 0 errs (turn -> 1), side 1 errs (turn -> 0), ...
    const pad0 = mistakes0;
    const pad1 = mistakes1;
    for (let i = 0; i < Math.max(pad0, pad1); i++) {
      if (i < pad0) s = submit(s, 0, wrongSets[k++]!).state;
      else s = ok(s, { t: 'timeout', turnId: s.turnId }).state;
      if (i < pad1) s = submit(s, 1, wrongSets[k++]!).state;
      else s = ok(s, { t: 'timeout', turnId: s.turnId }).state;
    }
    if (s.turn === 0) s = ok(s, { t: 'timeout', turnId: s.turnId }).state;
    s = submit(s, 1, ids(1), t1).state;
    return submit(s, 1, ids(2), t1).state;
  }

  it('equal scores: fewer mistakes wins', () => {
    const s = tied(1, 0, 1100, 1200);
    expect(s.scores).toEqual([5, 5]);
    expect(s.result?.winner).toBe(1);
  });

  it('equal scores and mistakes: the earlier last correct guess wins', () => {
    const s = tied(1, 1, 1100, 1200);
    expect(s.mistakes).toEqual([1, 1]);
    expect(s.result?.winner).toBe(0);
  });

  it('still tied: no winner yet, the price-guess round decides', () => {
    const s = tied(1, 1, 1500, 1500);
    expect(s.result).toEqual({ winner: null, reason: 'solved' });
    expect(resolveWinner(s, [2, 1])).toBe(0);
    expect(resolveWinner(s, [1, 3])).toBe(1);
    expect(resolveWinner(s, [2, 2])).toBeNull();
  });

  it('a decided puzzle result is not changed by the price-guess round', () => {
    const s = tied(1, 0, 1100, 1200);
    expect(resolveWinner(s, [4, 0])).toBe(1);
    const forfeited = ok(start(0), { t: 'forfeit', side: 0 }).state;
    expect(resolveWinner(forfeited, [0, 4])).toBe(1);
  });

  it('a locked-out side cannot win a tie off the price-guess round alone', () => {
    const base = tied(1, 1, 1500, 1500);
    const rigged: MatchState = { ...base, lockedOut: [true, false] };
    expect(resolveWinner(rigged, [3, 0])).toBeNull();
    expect(resolveWinner(rigged, [0, 3])).toBe(1);
  });

  it('a locked-out side that stayed gets the per-round bonus on its final tally', () => {
    const rigged: MatchState = { ...tied(1, 1, 1500, 1500), lockedOut: [true, false] };
    expect(finalScores(rigged, [2, 1])).toEqual([5 + 2, 5]);
  });

  it('resolveWinner refuses an unfinished match', () => {
    expect(() => resolveWinner(start(0), [0, 0])).toThrow();
  });
});

describe('matchClientView (redaction)', () => {
  it('shows the board and what is solved, never an unsolved group', () => {
    const s = submit(start(0), 0, ids(2)).state;
    const view = matchClientView(s, 'u1')!;
    const json = JSON.stringify(view);
    expect(view.you).toBe(1);
    expect(view.cards).toHaveLength(12);
    expect(view.solved).toEqual([{ level: 2, productIds: ids(2), by: 0 }]);
    expect(view.turnEndsAt).toBe(turnDeadline(s));
    expect(view).not.toHaveProperty('puzzle');
    expect(view).not.toHaveProperty('tried');
    // the remaining cards are shown, but nothing says which group they belong to
    expect(json).not.toContain('"level":0');
    expect(json).not.toContain('"level":1');
    expect(json).not.toContain('"level":3');
  });

  it('is null for a stranger and reveals everything once finished', () => {
    expect(matchClientView(start(0), 'ghost')).toBeNull();
    const done = ok(start(0), { t: 'forfeit', side: 0 }).state;
    expect(matchClientView(done, 'u0')!.solved).toHaveLength(4);
  });
});

describe('invariants (random play)', () => {
  const action = fc.record({ kind: fc.constantFrom('submit', 'submit', 'submit', 'timeout', 'stale'), who: fc.integer({ min: 0, max: 1 }), pick: fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 4, maxLength: 4 }), group: fc.integer({ min: 0, max: 3 }), exact: fc.boolean() });

  it('never breaks the board, score, mistake or turn invariants', () => {
    fc.assert(
      fc.property(fc.array(action, { maxLength: 80 }), fc.integer({ min: 0, max: 1000 }), (actions, seed) => {
        let s = startMatch(puzzle, U, mulberry32(seed), 0);
        let now = 0;
        let prev = s;
        for (const a of actions) {
          now += 1000;
          let cmd: Command;
          if (a.kind === 'timeout') cmd = { t: 'timeout', turnId: s.turnId };
          else if (a.kind === 'stale') cmd = { t: 'timeout', turnId: s.turnId + 5 };
          else {
            const itemIds = a.exact ? ids(a.group) : a.pick.map((i) => s.remaining[i % Math.max(1, s.remaining.length)] ?? 'x');
            cmd = { t: 'submit', by: U[a.who as MatchSide], itemIds };
          }
          const r = applyCommand(s, cmd, { now });
          if ('error' in r) continue;
          s = r.state;
          expect(s.scores[0]).toBeGreaterThanOrEqual(prev.scores[0]);
          expect(s.scores[1]).toBeGreaterThanOrEqual(prev.scores[1]);
          expect(Math.max(...s.mistakes)).toBeLessThanOrEqual(MATCH_MAX_MISTAKES);
          expect(s.turnId).toBeGreaterThanOrEqual(prev.turnId);
          expect(s.solved.length).toBeGreaterThanOrEqual(prev.solved.length);
          expect(new Set(s.solved.map((g) => g.level)).size).toBe(s.solved.length);
          expect(s.remaining.length + s.solved.reduce((n, g) => n + g.productIds.length, 0)).toBe(BOARD_SIZE);
          if (s.status === 'finished') {
            expect(s.result).not.toBeNull();
            expect(err(s, { t: 'timeout', turnId: s.turnId })).toBe('MATCH_FINISHED');
            break;
          }
          if (s.lockedOut[s.turn]) expect(s.lockedOut[s.turn === 0 ? 1 : 0]).toBe(true);
          prev = s;
        }
      }),
      { numRuns: 200 },
    );
  });
});
