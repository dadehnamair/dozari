import { describe, expect, it } from 'vitest';
import { applyTriviaCommand, startTriviaRound, toTriviaRoundView, triviaPoints, triviaWinner } from '../round.js';

const q = (id: string, correctIndex: number) => ({ id, textFa: `سؤال ${id}`, options: ['الف', 'ب', 'ج', 'د'], correctIndex, explanationFa: '' });

describe('trivia round', () => {
  it('reveals when both answered and scores right answers', () => {
    let s = startTriviaRound([q('1', 2), q('2', 0)]);
    s = applyTriviaCommand(s, { type: 'answer', side: 'a', index: 2 });
    expect(s.revealed).toHaveLength(0);
    s = applyTriviaCommand(s, { type: 'answer', side: 'b', index: 1 });
    expect(s.revealed).toHaveLength(1);
    expect(s.index).toBe(1);
    s = applyTriviaCommand(s, { type: 'answer', side: 'a', index: 0 });
    s = applyTriviaCommand(s, { type: 'answer', side: 'b', index: 0 });
    expect(s.status).toBe('finished');
    expect(triviaPoints(s)).toEqual([2, 1]);
  });

  it('ignores a second answer and bad indexes; a timeout reveals the missing ones as null', () => {
    let s = startTriviaRound([q('1', 1)]);
    s = applyTriviaCommand(s, { type: 'answer', side: 'a', index: 3 });
    const same = applyTriviaCommand(s, { type: 'answer', side: 'a', index: 1 });
    expect(same).toBe(s);
    expect(applyTriviaCommand(s, { type: 'answer', side: 'b', index: 9 })).toBe(s);
    s = applyTriviaCommand(s, { type: 'timeout' });
    expect(s.revealed[0]!.picks).toEqual({ a: 3, b: null });
    expect(triviaPoints(s)).toEqual([0, 0]);
  });

  it('the view hides the right choice and the rival pick until the reveal', () => {
    let s = startTriviaRound([q('1', 2), q('2', 1)]);
    s = applyTriviaCommand(s, { type: 'answer', side: 'a', index: 2 });
    const v = toTriviaRoundView(s, 'b', 1);
    expect(JSON.stringify(v)).not.toContain('correctIndex');
    expect(v.opponentAnswered).toBe(true);
    expect(v.youAnswered).toBe(false);
    s = applyTriviaCommand(s, { type: 'answer', side: 'b', index: 0 });
    const after = toTriviaRoundView(s, 'b', 1);
    expect(after.revealed[0]).toMatchObject({ correctIndex: 2, yourPick: 0, opponentPick: 2 });
    expect(after.roundIndex).toBe(1);
  });
});

describe('triviaWinner', () => {
  it('gives the side with more right answers, and a draw on equal points', () => {
    expect(triviaWinner([5, 3])).toBe(0);
    expect(triviaWinner([2, 6])).toBe(1);
    expect(triviaWinner([4, 4])).toBeNull();
    expect(triviaWinner([0, 0])).toBeNull();
  });
});
