import { describe, expect, it } from 'vitest';
import { revealKind, revealScores, triviaDuelAwards, triviaDuelNet, triviaSoloPassed, yourStreak } from '../economy.js';

describe('solo trivia', () => {
  it('passes at the refund percent and above', () => {
    expect(triviaSoloPassed(6, 8, 75)).toBe(true);
    expect(triviaSoloPassed(5, 8, 75)).toBe(false);
    expect(triviaSoloPassed(0, 8, 0)).toBe(true);
    expect(triviaSoloPassed(0, 0, 0)).toBe(false);
  });
});

describe('question duel coins', () => {
  it('the winner takes the pot minus the cut, the loser loses the fee', () => {
    expect(triviaDuelNet(12, 10, ['paid', 'paid'], 0, 'solved')).toEqual([9, -12]); // 21 paid out − 12
  });
  it('a draw refunds the fee minus the cut', () => {
    expect(triviaDuelNet(12, 10, ['paid', 'paid'], null, 'solved')).toEqual([-2, -2]);
  });
  it('a forfeit pays the rival and gives the leaver no consolation', () => {
    const a = triviaDuelAwards(12, 10, ['paid', 'paid'], 1, 'forfeit');
    expect(a[0]).toBeNull();
    expect(a[1]).toEqual({ kind: 'payout', coins: 21 });
  });
  it('a bot seat is covered by the house: the human wins the full pot, loses only their fee', () => {
    expect(triviaDuelNet(12, 10, ['paid', 'house'], 0, 'solved')).toEqual([9, 0]);
    expect(triviaDuelNet(12, 10, ['paid', 'house'], 1, 'solved')).toEqual([-12, 0]);
  });
  it('a free duel moves nothing', () => {
    expect(triviaDuelNet(0, 10, ['free', 'free'], 0, 'solved')).toEqual([0, 0]);
  });
});

describe('reveal helpers', () => {
  const rows = [
    { correctIndex: 1, yourPick: 1, opponentPick: 2 },
    { correctIndex: 0, yourPick: 0, opponentPick: 0 },
    { correctIndex: 3, yourPick: 2, opponentPick: 3 },
    { correctIndex: 2, yourPick: null, opponentPick: null },
  ];
  it('says who got each question', () => {
    expect(rows.map(revealKind)).toEqual(['you', 'both', 'rival', 'none']);
  });
  it('counts scores and the streak', () => {
    expect(revealScores(rows)).toEqual([2, 2]);
    expect(yourStreak(rows.slice(0, 2))).toBe(2);
    expect(yourStreak(rows)).toBe(0);
    expect(yourStreak([])).toBe(0);
  });
});
