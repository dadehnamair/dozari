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
