import { describe, expect, it } from 'vitest';
import type { TduelEnded, TduelFound, TduelState } from '@dozari/shared';
import { initialTduel, tduelOutcome, tduelReducer } from '../duelModel';

const ID = '0f8fad5b-d9cb-469f-a165-708677289501';
const player = (side: 0 | 1) => ({ userId: `u${side}`, side, nickname: `p${side}`, avatarKey: 'a', level: 1, coins: 0 });
const found: TduelFound = { matchId: ID, you: 0, youId: 'u0', topicNameFa: null, fee: 12, players: [player(0), player(1)] };
const round = { roundIndex: 0, totalRounds: 3, current: { textFa: 'q', options: ['a', 'b', 'c', 'd'] }, youAnswered: false, opponentAnswered: false, endsAt: 1000, revealed: [] };
const state: TduelState = { matchId: ID, you: 0, status: 'playing', round };
const ended: TduelEnded = { matchId: ID, winner: 1, reason: 'played', scores: [1, 2], coins: -12, canRematch: true, round: { ...round, current: null } };

describe('question duel model', () => {
  it('goes search → found → playing → ended', () => {
    let m = tduelReducer(initialTduel, { t: 'queued' });
    expect(m.phase).toBe('queued');
    m = tduelReducer(m, { t: 'status', waitedSec: 7 });
    expect(m.waitedSec).toBe(7);
    m = tduelReducer(m, { t: 'found', found });
    expect(m.phase).toBe('found');
    m = tduelReducer(m, { t: 'state', state });
    expect(m.phase).toBe('playing');
    m = tduelReducer(m, { t: 'ended', ended });
    expect(m).toMatchObject({ phase: 'ended', ended });
  });

  it('ignores a re-sent found card and a late snapshot once the game is on or over', () => {
    const playing = tduelReducer(tduelReducer(tduelReducer(initialTduel, { t: 'queued' }), { t: 'found', found }), { t: 'state', state });
    expect(tduelReducer(playing, { t: 'found', found }).phase).toBe('playing');
    const over = tduelReducer(playing, { t: 'ended', ended });
    expect(tduelReducer(over, { t: 'state', state }).phase).toBe('ended');
    expect(tduelReducer(over, { t: 'found', found }).phase).toBe('ended');
  });

  it('a status push after the rival is found does not change the clock; reset clears everything', () => {
    const f = tduelReducer(tduelReducer(initialTduel, { t: 'queued' }), { t: 'found', found });
    expect(tduelReducer(f, { t: 'status', waitedSec: 9 }).waitedSec).toBe(0);
    expect(tduelReducer(f, { t: 'reset' })).toEqual(initialTduel);
  });

  it('tells the outcome per side', () => {
    expect(tduelOutcome(ended, 1)).toBe('won');
    expect(tduelOutcome(ended, 0)).toBe('lost');
    expect(tduelOutcome({ ...ended, winner: null }, 0)).toBe('draw');
  });

  it('a rematch is a new game: a different found card starts clean, while a re-sent one of the same game does not', () => {
    const over = tduelReducer(tduelReducer(tduelReducer(tduelReducer(initialTduel, { t: 'queued' }), { t: 'found', found }), { t: 'state', state }), { t: 'ended', ended });
    const second = '1f8fad5b-d9cb-469f-a165-708677289502';
    const again = tduelReducer(over, { t: 'found', found: { ...found, matchId: second } });
    expect(again).toMatchObject({ phase: 'found', ended: null, state: null, rematch: 'none' });
    expect(again.found?.matchId).toBe(second);
    expect(tduelReducer(over, { t: 'found', found }).phase).toBe('ended');
    expect(tduelReducer(again, { t: 'state', state: { ...state, matchId: second } }).phase).toBe('playing');
  });

  it('tracks the rematch chance: the rival asks, I ask, it expires', () => {
    const over = tduelReducer(tduelReducer(tduelReducer(initialTduel, { t: 'queued' }), { t: 'found', found }), { t: 'ended', ended });
    expect(tduelReducer(over, { t: 'offer', state: 'asked' }).rematch).toBe('asked');
    const sent = tduelReducer(over, { t: 'rematchSent' });
    expect(sent.rematch).toBe('sent');
    expect(tduelReducer(sent, { t: 'offer', state: 'asked' }).rematch).toBe('sent'); // my own ask is not overwritten
    expect(tduelReducer(sent, { t: 'offer', state: 'expired' }).rematch).toBe('expired');
    // an offer during the search or a game means nothing
    expect(tduelReducer(tduelReducer(initialTduel, { t: 'queued' }), { t: 'offer', state: 'asked' }).rematch).toBe('none');
  });

  it('a refusal ends the search and keeps the reason', () => {
    const m = tduelReducer(tduelReducer(initialTduel, { t: 'queued' }), { t: 'refused', error: 'INSUFFICIENT_COINS' });
    expect(m).toMatchObject({ phase: 'idle', refused: 'INSUFFICIENT_COINS' });
  });
});
