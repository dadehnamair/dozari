import { describe, expect, it } from 'vitest';
import type { MatchView } from '@dozari/shared';
import { fa } from '../../i18n/fa';
import { arenaNumbers, arrange, characterFor, clockText, endReason, groupsBy, shuffled, tugPercent } from '../arena';

const view = (by: Array<0 | 1 | null>): MatchView => ({
  matchId: '0f8fad5b-d9cb-469f-a165-708677289501',
  you: 0,
  cards: [],
  solved: by.map((b, i) => ({ level: i as 0, titleFa: 'g', explanationFa: '', productIds: [], by: b })),
  scores: [0, 0],
  mistakes: [0, 0],
  lockedOut: [false, false],
  turn: 0,
  turnId: 1,
  turnEndsAt: 0,
  status: 'playing',
  result: null,
});

describe('arena helpers', () => {
  it('reads the mode-card numbers from settings, with the shared defaults', () => {
    expect(arenaNumbers({})).toEqual({ entry: 20, prize: 36, maxMistakes: 4 });
    expect(arenaNumbers({ 'duel.entry_fee': 50, 'duel.house_cut_percent': 0, 'game.match_max_mistakes': 3 })).toEqual({ entry: 50, prize: 100, maxMistakes: 3 });
    expect(arenaNumbers({ 'duel.entry_fee': 'x', 'duel.house_cut_percent': -1 })).toEqual({ entry: 20, prize: 36, maxMistakes: 4 });
  });

  it('gives an opponent a stable market character, never the hero', () => {
    expect(characterFor('avatar-7')).toBe(characterFor('avatar-7'));
    for (const k of ['a', 'b', 'c', 'zz', '']) expect(['dozari', 'dozariF']).not.toContain(characterFor(k));
  });

  it('counts groups per side and moves the tug bar 12.5% per group', () => {
    const v = view([0, 1, 0, null]);
    expect([groupsBy(v, 0), groupsBy(v, 1)]).toEqual([2, 1]);
    expect(tugPercent(2, 1)).toBe(62.5);
    expect(tugPercent(0, 0)).toBe(50);
    expect(tugPercent(4, 0)).toBe(100);
  });

  it('formats the turn clock', () => {
    expect(clockText(45)).toBe('0:45');
    expect(clockText(5)).toBe('0:05');
  });

  it('keeps a local card order and appends unknown cards', () => {
    const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(arrange(cards, ['c', 'a']).map((c) => c.id)).toEqual(['c', 'a', 'b']);
    expect(arrange(cards, []).map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect([...shuffled(['a', 'b', 'c'], () => 0)].sort()).toEqual(['a', 'b', 'c']);
  });

  it('words the end reason from the player side', () => {
    expect(endReason('won', 'abandon')).toBe(fa.duel.reasons.abandon);
    expect(endReason('lost', 'abandon')).toBe(fa.duel.arena.youLeft);
    expect(endReason('lost', 'solved')).toBe(fa.duel.reasons.solved);
  });
});
