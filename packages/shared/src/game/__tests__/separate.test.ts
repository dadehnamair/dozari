import { describe, expect, it } from 'vitest';
import { DEFAULT_MATCH_RULES, applyCommand, matchClientView, startTeamMatch } from '../match.js';
import type { Command, MatchEvent, MatchSide, MatchState } from '../match.js';
import { mulberry32 } from '../rng.js';
import type { GroupLevel, SoloPuzzle } from '../solo.js';

const mk = (tag: string): SoloPuzzle => ({
  groups: ([0, 1, 2, 3] as GroupLevel[]).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `${tag}g${level}p${i}`) })),
});
const A = mk('a');
const B = mk('b');
const U = ['u0', 'u1'] as const;
const rules = { ...DEFAULT_MATCH_RULES, separateBoards: true };
const start = (boards: SoloPuzzle[] = [A], side: MatchSide = 0) => startTeamMatch(boards, [[U[0]], [U[1]]], mulberry32(3), 1000, side, rules);
const ids = (p: SoloPuzzle, level: number) => p.groups[level]!.productIds as string[];

function ok(state: MatchState, cmd: Command, now = 2000) {
  const r = applyCommand(state, cmd, { now });
  if ('error' in r) throw new Error(r.error);
  return r;
}
const submit = (s: MatchState, side: MatchSide, itemIds: string[]) => ok(s, { t: 'submit', by: U[side], itemIds });
/** Never correct and never one away: two cards from group 0 and two from group 1. */
const wrong = (n: number): string[] => {
  const pairs: string[][] = [];
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) for (let c = 0; c < 4; c++) for (let d = c + 1; d < 4; d++) pairs.push([`ag1p${a}`, `ag1p${b}`, `ag2p${c}`, `ag2p${d}`]);
  return pairs[n]!;
};

describe('separate boards', () => {
  it('gives each side its own order of the same 16 cards', () => {
    const s = start();
    expect(s.sep!.remaining[0]).toHaveLength(16);
    expect([...s.sep!.remaining[0]].sort()).toEqual([...s.sep!.remaining[1]].sort());
    expect(s.sep!.remaining[0]).not.toEqual(s.sep!.remaining[1]);
  });

  it("a solve touches only the solver's board and the rival learns just a count", () => {
    const s = start();
    const r = submit(s, 0, ids(A, 0));
    expect(r.state.sep!.solved[0]).toHaveLength(1);
    expect(r.state.sep!.solved[1]).toHaveLength(0);
    expect(r.state.sep!.remaining[1]).toHaveLength(16);
    expect(r.events).toContainEqual({ t: 'found', side: 0, count: 1 } satisfies MatchEvent);
    expect(r.state.turn).toBe(0); // a correct guess keeps the turn
    const rival = matchClientView(r.state, 'u1')!;
    expect(rival.found).toEqual([1, 0]);
    expect(rival.solved).toEqual([]);
    expect(rival.cards).toHaveLength(16);
    expect(matchClientView(r.state, 'u0')!.cards).toHaveLength(12);
  });

  it('both sides can find the same group', () => {
    let s = submit(start([A], 0), 0, ids(A, 0)).state;
    s = submit(s, 0, wrong(0)).state; // wrong guess passes the turn
    s = submit(s, 1, ids(A, 0)).state;
    expect(s.sep!.solved[1]).toHaveLength(1);
  });

  it('the first side to find all four wins the board; the last group is the cards left', () => {
    let s = start();
    for (const lvl of [0, 1, 2]) s = submit(s, 0, ids(A, lvl)).state;
    expect(s.status).toBe('finished');
    expect(s.boardsWon).toEqual([1, 0]);
    expect(s.result).toEqual({ winner: 0, reason: 'solved' });
    expect(s.sep!.solved[0]).toHaveLength(4);
  });

  it('a multi-board match goes to the side that won more boards', () => {
    let s = start([A, B], 0);
    for (const lvl of [0, 1, 2]) s = submit(s, 0, ids(A, lvl)).state;
    expect(s.status).toBe('playing');
    expect([s.round, s.boardsWon, s.turn]).toEqual([1, [1, 0], 1]);
    expect(s.sep!.solved).toEqual([[], []]);
    for (const lvl of [0, 1, 2]) s = submit(s, 1, ids(B, lvl)).state;
    expect(s.status).toBe('finished');
    expect(s.boardsWon).toEqual([1, 1]);
  });

  it('both locked out: the side with more groups takes the board', () => {
    let s = submit(start([A], 0), 0, ids(A, 0)).state;
    let n = 0;
    while (s.status === 'playing') {
      s = submit(s, s.turn, wrong(n++)).state;
    }
    expect(s.result?.reason).toBe('locked_out');
    expect(s.boardsWon).toEqual([1, 0]);
  });

  it('rejects a repeated set only for the side that already tried it', () => {
    let s = submit(start([A], 0), 0, wrong(0)).state;
    expect(applyCommand(submit(s, 1, wrong(5)).state, { t: 'submit', by: 'u0', itemIds: wrong(0) }, { now: 3000 })).toEqual({ error: 'DUPLICATE_SELECTION' });
    s = submit(start([A], 0), 0, wrong(0)).state;
    expect('error' in applyCommand(s, { t: 'submit', by: 'u1', itemIds: wrong(0) }, { now: 3000 })).toBe(false);
  });
});

describe('separate boards, timeouts', () => {
  const timeout = (s: MatchState) => ok(s, { t: 'timeout', turnId: s.turnId });

  it('two idle sides lock each other out; nobody forfeits and nobody wins the board', () => {
    let s = start([A], 0);
    for (let i = 0; i < 40 && s.status === 'playing'; i++) s = timeout(s).state;
    expect(s.result).toEqual({ winner: null, reason: 'locked_out' });
    expect(s.boardsWon).toEqual([0, 0]);
  });

  it('timeouts alone can lock a side out, and the other side then has to win by finding its groups', () => {
    let s = start([A], 0);
    for (let i = 0; i < 4 && !s.lockedOut[0]; i++) {
      s = timeout(s).state; // side 0 times out
      if (!s.lockedOut[0]) s = submit(s, 1, wrong(i)).state; // side 1 makes a wrong guess instead (turn passes back)
    }
    expect(s.lockedOut[0]).toBe(true);
    expect(s.status).toBe('playing'); // side 1 is still in: nobody has won yet
    expect(s.boardsWon).toEqual([0, 0]);
  });

  it('the timed-out side gets a timeout event, with the mistake in the count', () => {
    const r = timeout(start([A], 0));
    expect(r.events).toContainEqual({ t: 'timeout', side: 0 } satisfies MatchEvent);
    expect(r.state.mistakes).toEqual([1, 0]);
    expect(r.state.turn).toBe(1);
  });
});

describe('bought match items', () => {
  const withItems = (shuffle = 1, reveal = 1, boards: SoloPuzzle[] = [A]) =>
    startTeamMatch(boards, [[U[0]], [U[1]]], mulberry32(3), 1000, 0, rules, { u0: { shuffle, reveal }, u1: { shuffle: 0, reveal: 0 } });
  const power = (s: MatchState, by: string, kind: 'shuffle' | 'reveal', order?: string[]) => applyCommand(s, { t: 'power', by, kind, order }, { now: 2000 });

  it('shuffle re-orders only the rival\'s remaining cards, costs nothing else and counts down', () => {
    const s = withItems();
    const order = [...s.sep!.remaining[1]].reverse();
    const r = power(s, 'u0', 'shuffle', order);
    if ('error' in r) throw new Error(r.error);
    expect(r.state.sep!.remaining[1]).toEqual(order);
    expect(r.state.sep!.remaining[0]).toEqual(s.sep!.remaining[0]);
    expect([r.state.turn, r.state.turnId, r.state.mistakes]).toEqual([s.turn, s.turnId, s.mistakes]);
    expect(matchClientView(r.state, 'u0')!.items).toEqual({ shuffle: 0, reveal: 1 });
    expect(r.events).toEqual([{ t: 'power', side: 0, kind: 'shuffle' }]);
  });

  it('shuffle needs a real permutation, a stock, separate boards and works once per match', () => {
    const s = withItems();
    expect(power(s, 'u0', 'shuffle', s.sep!.remaining[1].slice(1) as string[])).toEqual({ error: 'INVALID_SELECTION' });
    expect(power(s, 'u1', 'shuffle', [...s.sep!.remaining[0]])).toEqual({ error: 'NO_POWER' });
    const done = power(s, 'u0', 'shuffle', [...s.sep!.remaining[1]].reverse());
    if ('error' in done) throw new Error(done.error);
    expect(power(done.state, 'u0', 'shuffle', [...done.state.sep!.remaining[1]])).toEqual({ error: 'NO_POWER' });
    expect(power(withItems(3), 'u0', 'shuffle', [...s.sep!.remaining[1]]).hasOwnProperty('state')).toBe(true);
    const shared = startTeamMatch([A], [[U[0]], [U[1]]], mulberry32(3), 1000, 0, DEFAULT_MATCH_RULES, { u0: { shuffle: 1, reveal: 0 } });
    expect(power(shared, 'u0', 'shuffle', [...shared.remaining])).toEqual({ error: 'NO_POWER' });
  });

  it('a stock of three still allows one use per match', () => {
    let s = withItems(3);
    s = (() => {
      const r = power(s, 'u0', 'shuffle', [...s.sep!.remaining[1]].reverse());
      if ('error' in r) throw new Error(r.error);
      return r.state;
    })();
    expect(power(s, 'u0', 'shuffle', [...s.sep!.remaining[1]].reverse())).toEqual({ error: 'POWER_USED' });
  });

  it('reveal shows the user (alone) the four cards of the easiest group still open, on their own turn only', () => {
    const s = withItems();
    expect(power(s, 'u1', 'reveal')).toEqual({ error: 'NO_POWER' });
    const r = power(s, 'u0', 'reveal');
    if ('error' in r) throw new Error(r.error);
    expect(r.events).toEqual([{ t: 'power', side: 0, kind: 'reveal', itemIds: ids(A, 0) }]);
    expect(r.state.sep!.solved[0]).toHaveLength(0); // it only shows, the user still has to submit it
    const found = submit(s, 0, ids(A, 0)).state;
    const again = power(found, 'u0', 'reveal');
    if ('error' in again) throw new Error(again.error);
    expect((again.events[0] as unknown as { itemIds: string[] }).itemIds).toEqual(ids(A, 1));
    const off = ok(s, { t: 'submit', by: 'u0', itemIds: wrong(0) }).state; // turn passes to u1
    expect(power(off, 'u0', 'reveal')).toEqual({ error: 'NOT_YOUR_TURN' });
  });
});
