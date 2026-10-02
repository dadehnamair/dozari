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
