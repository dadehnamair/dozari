import { describe, expect, it } from 'vitest';
import { applyCommand, matchClientView, startTeamMatch } from '../match.js';
import type { Command, MatchEvent, MatchSide, MatchState } from '../match.js';
import { mulberry32 } from '../rng.js';
import type { GroupLevel, SoloPuzzle } from '../solo.js';

const puzzle: SoloPuzzle = {
  groups: ([0, 1, 2, 3] as GroupLevel[]).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`) })),
};
const ids = (level: number) => puzzle.groups[level]!.productIds as string[];
const start = (side: MatchSide = 0) => startTeamMatch(puzzle, [['a1', 'a2'], ['b1', 'b2']], mulberry32(1), 1000, side);
const ok = (state: MatchState, cmd: Command, now = 2000): { state: MatchState; events: MatchEvent[] } => {
  const r = applyCommand(state, cmd, { now });
  if ('error' in r) throw new Error(`unexpected ${r.error}`);
  return r;
};
const err = (state: MatchState, cmd: Command) => {
  const r = applyCommand(state, cmd, { now: 2000 });
  return 'error' in r ? r.error : null;
};
const wrong = ['g0p0', 'g0p1', 'g1p0', 'g1p1'];
const wrongLater = ['g1p0', 'g1p1', 'g2p0', 'g2p1'];

describe('team match', () => {
  it('seats two per side with the first teammate as captain', () => {
    const s = start();
    expect(s.players.map((p) => [p.userId, p.side])).toEqual([['a1', 0], ['a2', 0], ['b1', 1], ['b2', 1]]);
    expect(s.captain).toEqual(['a1', 'b1']);
    expect(() => startTeamMatch(puzzle, [['a1', 'a2'], ['b1']], mulberry32(1), 0)).toThrow();
    expect(() => startTeamMatch(puzzle, [['a1', 'a2'], ['b1', 'a1']], mulberry32(1), 0)).toThrow();
  });

  it('only the captain of the active side submits', () => {
    const s = start(0);
    expect(err(s, { t: 'submit', by: 'a2', itemIds: ids(0) })).toBe('NOT_CAPTAIN');
    expect(err(s, { t: 'submit', by: 'b1', itemIds: ids(0) })).toBe('NOT_YOUR_TURN');
    expect(ok(s, { t: 'submit', by: 'a1', itemIds: ids(0) }).state.scores[0]).toBeGreaterThan(0);
  });

  it('rotates the captain every turn but not on a streak', () => {
    let s = start(0);
    s = ok(s, { t: 'submit', by: 'a1', itemIds: ids(0) }).state; // correct: streak, same captain
    expect([s.turn, s.captain[0]]).toEqual([0, 'a1']);
    s = ok(s, { t: 'submit', by: 'a1', itemIds: wrongLater }).state; // wrong: turn to side 1
    expect([s.turn, s.captain[1]]).toEqual([1, 'b2']);
    s = ok(s, { t: 'submit', by: 'b2', itemIds: ['g1p2', 'g2p2', 'g2p3', 'g3p0'] }).state;
    expect([s.turn, s.captain[0]]).toEqual([0, 'a2']);
  });

  it('proposals are events, never state, and only for a team on turn', () => {
    const s = start(0);
    const r = ok(s, { t: 'propose', by: 'a2', itemIds: ['g0p0', 'g0p1'] });
    expect(r.state).toBe(s);
    expect(r.events).toEqual([{ t: 'proposal', side: 0, by: 'a2', itemIds: ['g0p0', 'g0p1'] }]);
    expect(err(s, { t: 'propose', by: 'b1', itemIds: [] })).toBe('NOT_YOUR_TURN');
    expect(err(s, { t: 'propose', by: 'a2', itemIds: ['nope'] })).toBe('INVALID_SELECTION');
    const duel = startTeamMatch(puzzle, [['x'], ['y']], mulberry32(1), 0, 0);
    expect(err(duel, { t: 'propose', by: 'x', itemIds: [] })).toBe('NOT_TEAM_MATCH');
  });

  it('a leaving captain hands over; the team carries on; both gone forfeits', () => {
    let s = ok(start(0), { t: 'leave', by: 'a1' }).state;
    expect(s.status).toBe('playing');
    expect(s.captain[0]).toBe('a2');
    expect(err(s, { t: 'submit', by: 'a1', itemIds: ids(0) })).toBe('UNKNOWN_PLAYER');
    s = ok(s, { t: 'submit', by: 'a2', itemIds: wrong }).state;
    s = ok(s, { t: 'submit', by: 'b2', itemIds: ids(1) }).state;
    const end = ok(s, { t: 'leave', by: 'b1' }).state;
    expect(end.status).toBe('playing');
    const done = ok(end, { t: 'leave', by: 'b2' });
    expect(done.state.result).toMatchObject({ winner: 0, reason: 'abandon' });
  });

  it('the client view carries the captains and nothing about unsolved groups', () => {
    const v = matchClientView(start(0), 'a2')!;
    expect(v.you).toBe(0);
    expect(v.captain).toEqual(['a1', 'b1']);
    expect(JSON.stringify(v)).not.toContain('"level"');
  });
});

describe('multi-board match (2v2)', () => {
  const board = (tag: string): SoloPuzzle => ({
    groups: ([0, 1, 2, 3] as GroupLevel[]).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `${tag}g${level}p${i}`) })),
  });
  const boards = [board('a'), board('b'), board('c')];
  const ids = (tag: string, level: number) => [0, 1, 2, 3].map((i) => `${tag}g${level}p${i}`);
  const start3 = () => startTeamMatch(boards, [['a1', 'a2'], ['b1', 'b2']], mulberry32(1), 1000, 0);
  const capt = (s: MatchState) => s.captain[s.turn];
  /** The side on turn solves the first three groups of the board in play. */
  const solveBoard = (s: MatchState, tag: string) => {
    let st = s;
    const events: MatchEvent[] = [];
    for (let level = 0; level < 3; level++) {
      const r = ok(st, { t: 'submit', by: capt(st)!, itemIds: ids(tag, level) });
      st = r.state;
      events.push(...r.events);
    }
    return { state: st, events };
  };

  it('plays three boards: scores add up, the next board is opened by the other side, and mistakes reset', () => {
    let s = start3();
    expect([s.round, s.rounds, s.upcoming.length]).toEqual([0, 3, 2]);
    // side 0 makes a mistake on board 1, then solves it
    s = ok(s, { t: 'submit', by: 'a1', itemIds: ['ag0p0', 'ag0p1', 'ag1p0', 'ag1p1'] }).state;
    s = ok(s, { t: 'submit', by: s.captain[1], itemIds: ['ag2p0', 'ag2p1', 'ag3p0', 'ag3p1'] }).state; // side 1 also errs
    const one = solveBoard(s, 'a');
    expect(one.events.map((e) => e.t)).toContain('board_done');
    s = one.state;
    expect([s.status, s.round, s.solved.length, s.mistakes, s.mistakesBefore]).toEqual(['playing', 1, 0, [0, 0], [1, 1]]);
    expect(s.turn).toBe(1); // board 1 was opened by side 0, so board 2 is opened by side 1
    expect(s.scores[0]).toBeGreaterThan(0);
    expect(s.remaining.every((id) => id.startsWith('b'))).toBe(true);
    const before = s.scores[1];
    s = solveBoard(s, 'b').state;
    expect([s.round, s.turn]).toEqual([2, 0]);
    expect(s.scores[1]).toBeGreaterThan(before);
    const last = solveBoard(s, 'c');
    expect(last.state.status).toBe('finished');
    expect(last.state.result?.reason).toBe('solved');
    expect(last.state.solved).toHaveLength(4);
    expect(last.events.map((e) => e.t)).not.toContain('board_done');
  });

  it('first blood counts only on the first board, and a forfeit ends all boards at once', () => {
    let s = start3();
    const first = ok(s, { t: 'submit', by: capt(s)!, itemIds: ids('a', 0) });
    expect(first.events.find((e) => e.t === 'group_solved')).toMatchObject({ firstBlood: true });
    s = solveBoard(start3(), 'a').state;
    const second = ok(s, { t: 'submit', by: capt(s)!, itemIds: ids('b', 0) });
    expect(second.events.find((e) => e.t === 'group_solved')).toMatchObject({ firstBlood: false });
    const gone = ok(ok(s, { t: 'leave', by: 'a1' }).state, { t: 'leave', by: 'a2' });
    expect(gone.state.status).toBe('finished');
    expect(gone.state.result).toMatchObject({ winner: 1, reason: 'abandon' });
  });

  it('a board where both sides lock out moves on; the client view shows the round, never the next board', () => {
    let s = start3();
    const wrongs = [
      ['ag0p0', 'ag0p1', 'ag1p0', 'ag1p1'], ['ag0p0', 'ag0p2', 'ag1p0', 'ag1p2'], ['ag0p0', 'ag0p3', 'ag1p0', 'ag1p3'], ['ag0p1', 'ag0p2', 'ag1p1', 'ag1p2'],
      ['ag0p1', 'ag0p3', 'ag1p1', 'ag1p3'], ['ag0p2', 'ag0p3', 'ag1p2', 'ag1p3'], ['ag2p0', 'ag2p1', 'ag3p0', 'ag3p1'], ['ag2p0', 'ag2p2', 'ag3p0', 'ag3p2'],
    ];
    for (const w of wrongs) s = ok(s, { t: 'submit', by: capt(s)!, itemIds: w }).state;
    expect([s.round, s.status, s.lockedOut]).toEqual([1, 'playing', [false, false]]);
    const v = matchClientView(s, 'a1')!;
    expect([v.round, v.rounds]).toEqual([1, 3]);
    expect(JSON.stringify(v)).not.toContain('cg0');
  });
});
