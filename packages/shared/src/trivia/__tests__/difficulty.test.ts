import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../game/rng.js';
import { measuredDifficulty, triviaGroupLevel, triviaTargetDifficulty } from '../difficulty.js';
import { pickFreshTrivia } from '../logic.js';

describe('target difficulty', () => {
  it('maps a level to easy / medium / hard with the admin thresholds', () => {
    expect(triviaTargetDifficulty(1)).toBe(1);
    expect(triviaTargetDifficulty(6)).toBe(2);
    expect(triviaTargetDifficulty(15)).toBe(3);
    expect(triviaTargetDifficulty(4, { mediumFrom: 3, hardFrom: 4 })).toBe(3);
  });
  it('a duel is as hard as the average of the two', () => {
    expect(triviaGroupLevel([2, 12])).toBe(7);
    expect(triviaGroupLevel([])).toBe(1);
  });
});

describe('measured difficulty', () => {
  it('needs enough answers, then reads the right-rate', () => {
    expect(measuredDifficulty(10, 10)).toBeNull();
    expect(measuredDifficulty(40, 36)).toBe(1);
    expect(measuredDifficulty(40, 24)).toBe(2);
    expect(measuredDifficulty(40, 10)).toBe(3);
    expect(measuredDifficulty(0, 0)).toBeNull();
  });
});

describe('pickFreshTrivia with a target', () => {
  const pool = [1, 1, 2, 2, 3, 3].map((difficulty, i) => ({ id: `q${i}`, topicId: 't', textFa: `q${i}`, options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanationFa: '', difficulty }));
  it('takes the closest difficulty first among unseen questions', () => {
    expect(pickFreshTrivia(pool, 2, mulberry32(1), [], undefined, 3).map((q) => q.difficulty)).toEqual([3, 3]);
    expect(pickFreshTrivia(pool, 4, mulberry32(1), [], undefined, 1).map((q) => q.difficulty).sort()).toEqual([1, 1, 2, 2]);
  });
  it('but unseen always beats a better fit', () => {
    const seenHard = new Map([['q4', 1], ['q5', 2]]);
    expect(pickFreshTrivia(pool, 2, mulberry32(1), [seenHard], undefined, 3).map((q) => q.difficulty).sort()).toEqual([2, 2]);
  });
});
