import { describe, expect, it } from 'vitest';
import type { MatchEnded, MatchView } from '@dozari/shared';
import { boardSolved, duelReducer, initialDuel, isMyTurn, myOutcome, turnSecondsLeft } from '../model';

const ID = '0f8fad5b-d9cb-469f-a165-708677289501';
const view = (over: Partial<MatchView> = {}): MatchView => ({
  matchId: ID,
  you: 0,
  cards: [{ id: 'a', nameFa: 'نان', unitFa: null, iconKey: null }],
  solved: [{ level: 0, titleFa: 'گروه', explanationFa: 'چرا', productIds: ['x'], by: null }],
  scores: [0, 0],
  mistakes: [0, 0],
  lockedOut: [false, false],
  turn: 0,
  turnId: 1,
  turnEndsAt: 10_000,
  status: 'playing',
  result: null,
  ...over,
});

describe('duel model', () => {
  it('walks queued -> playing -> ended and keeps card names', () => {
    let s = duelReducer(initialDuel, { t: 'queued' });
    expect(s.phase).toBe('queued');
    s = duelReducer(s, { t: 'status', waitedSec: 4 });
    expect(s.waitedSec).toBe(4);
    s = duelReducer(s, { t: 'state', view: view() });
    expect(s.phase).toBe('playing');
    expect(s.names).toEqual({ a: 'نان' });
    s = duelReducer(s, { t: 'state', view: view({ cards: [{ id: 'b', nameFa: 'شیر', unitFa: null, iconKey: null }] }) });
    expect(s.names).toEqual({ a: 'نان', b: 'شیر' });
    const ended = { matchId: ID, result: { winner: 0, reason: 'solved' }, scores: [4, 1], groups: [] } as unknown as MatchEnded;
    s = duelReducer(s, { t: 'ended', ended });
    expect(s.phase).toBe('ended');
  });
  it('flashes only my own guesses', () => {
    const s = duelReducer(initialDuel, { t: 'guess', outcome: 'wrong', mine: false });
    expect(s.flash).toBeNull();
    expect(duelReducer(s, { t: 'guess', outcome: 'one_away', mine: true }).flash).toBe('one_away');
  });
  it('maps solved rows, turn and clock', () => {
    expect(boardSolved(view())[0]).toMatchObject({ revealed: true });
    expect(isMyTurn(view())).toBe(true);
    expect(isMyTurn(view({ turn: 1 }))).toBe(false);
    expect(isMyTurn(view({ lockedOut: [true, false] }))).toBe(false);
    expect(turnSecondsLeft(view(), 7_500)).toBe(3);
    expect(turnSecondsLeft(view(), 99_000)).toBe(0);
  });
  it('tells the outcome from the player side', () => {
    const e = (winner: 0 | 1 | null) => ({ result: { winner, reason: 'solved' } }) as MatchEnded;
    expect(myOutcome(e(0), 0)).toBe('won');
    expect(myOutcome(e(1), 0)).toBe('lost');
    expect(myOutcome(e(null), 1)).toBe('draw');
  });
});

describe('duel taunts', () => {
  it('shows the latest taunt and clears it', () => {
    let s = duelReducer(initialDuel, { t: 'taunt', from: 'علی', text: 'بیا جلو' });
    expect(s.taunt).toEqual({ from: 'علی', text: 'بیا جلو' });
    s = duelReducer(s, { t: 'clearTaunt' });
    expect(s.taunt).toBeNull();
  });
});

describe('finale and notices', () => {
  const card = (id: string) => ({ id, nameFa: id, unitFa: null, iconKey: null });
  const row = (level: 0 | 1 | 2 | 3, ids: string[], by: 0 | 1 | null) => ({ level, titleFa: `t${level}`, explanationFa: `e${level}`, productIds: ids, by });
  const g = (level: number, ids: string[]) => ({ level, titleFa: `t${level}`, explanationFa: `e${level}`, productIds: ids });
  const before = view({ cards: ['c1', 'c2', 'c3', 'c4', 'd1', 'd2', 'd3', 'd4'].map(card), solved: [row(0, ['a1', 'a2', 'a3', 'a4'], 0), row(1, ['b1', 'b2', 'b3', 'b4'], 1)] });
  const after = view({ cards: [], status: 'finished', solved: [row(0, ['a1', 'a2', 'a3', 'a4'], 0), row(1, ['b1', 'b2', 'b3', 'b4'], 1), row(2, ['c1', 'c2', 'c3', 'c4'], 0), row(3, ['d1', 'd2', 'd3', 'd4'], null)] });

  it('builds the finale of the last row once the game reveals it', () => {
    let s = duelReducer(initialDuel, { t: 'state', view: before });
    s = duelReducer(s, { t: 'state', view: after });
    expect(s.prevBoard?.cards).toHaveLength(8);
    s = duelReducer(s, { t: 'revealed', level: 3 });
    expect(s.finale?.cards.map((c) => c.id)).toEqual(['d1', 'd2', 'd3', 'd4']);
    expect(s.finale?.solved.map((r) => r.level)).toEqual([0, 1, 2]);
    expect(s.finale?.last.level).toBe(3);
    expect(duelReducer(s, { t: 'clearFinale' }).finale).toBeNull();
  });

  it('waits for board_done when the next board has already replaced the old one', () => {
    let s = duelReducer(initialDuel, { t: 'state', view: before });
    s = duelReducer(s, { t: 'state', view: view({ round: 1, rounds: 2, cards: ['x1', 'x2'].map(card), solved: [] }) });
    s = duelReducer(s, { t: 'revealed', level: 3 });
    expect(s.finale).toBeNull();
    s = duelReducer(s, { t: 'boardDone', round: 0, groups: [g(0, ['a1', 'a2', 'a3', 'a4']), g(1, ['b1', 'b2', 'b3', 'b4']), g(2, ['c1', 'c2', 'c3', 'c4']), g(3, ['d1', 'd2', 'd3', 'd4'])] });
    expect(s.finale?.cards).toHaveLength(4);
  });

  it('a refused submit is a notice, never a dead end; a result clears any stale error', () => {
    let s = duelReducer(initialDuel, { t: 'state', view: view() });
    s = duelReducer(s, { t: 'notice', error: 'DUPLICATE_SELECTION' });
    expect(s.notice).toBe('DUPLICATE_SELECTION');
    expect(s.error).toBeNull();
    s = duelReducer(s, { t: 'error', error: 'NETWORK' });
    s = duelReducer(s, { t: 'state', view: view() });
    expect(s.error).toBeNull();
    s = duelReducer(s, { t: 'error', error: 'INTERNAL' });
    s = duelReducer(s, { t: 'ended', ended: { matchId: ID, result: { winner: 0, reason: 'solved' }, scores: [1, 0], groups: [] } as unknown as MatchEnded });
    expect(s.error).toBeNull();
  });
});
