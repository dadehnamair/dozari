import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../game/rng.js';
import { triviaInputSchema } from '../contract.js';
import { pickTriviaQuestions, shuffleTrivia } from '../logic.js';
import type { TriviaQuestion } from '../logic.js';

const topicId = '0f8fad5b-d9cb-469f-a165-708677289501';
const q = (id: string, correctIndex = 2): TriviaQuestion => ({ id, topicId, textFa: 'پایتخت ایران کدام شهر است؟', options: ['شیراز', 'اصفهان', 'تهران', 'تبریز'], correctIndex, explanationFa: '' });

describe('triviaInputSchema', () => {
  const ok = { topicId, textFa: 'کدام یک میوه است؟', options: ['سیب', 'نان', 'شیر', 'برنج'], correctIndex: 0 };
  it('accepts four different choices under a topic', () => {
    expect(triviaInputSchema.safeParse(ok).success).toBe(true);
  });
  it('rejects a missing topic, repeated choices, a wrong count and an index out of range', () => {
    expect(triviaInputSchema.safeParse({ ...ok, topicId: undefined }).success).toBe(false);
    expect(triviaInputSchema.safeParse({ ...ok, options: ['سیب', 'سیب', 'شیر', 'برنج'] }).success).toBe(false);
    expect(triviaInputSchema.safeParse({ ...ok, options: ['سیب', 'نان', 'شیر'] }).success).toBe(false);
    expect(triviaInputSchema.safeParse({ ...ok, correctIndex: 4 }).success).toBe(false);
  });
});

describe('shuffleTrivia', () => {
  it('keeps the same choices and tracks where the right one went', () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = shuffleTrivia(q('a'), mulberry32(seed));
      expect([...s.options].sort()).toEqual([...q('a').options].sort());
      expect(s.options[s.correctIndex]).toBe('تهران');
    }
  });
  it('moves the right answer around', () => {
    const spots = new Set(Array.from({ length: 40 }, (_, s) => shuffleTrivia(q('a'), mulberry32(s)).correctIndex));
    expect(spots.size).toBeGreaterThan(1);
  });
});

describe('pickTriviaQuestions', () => {
  it('picks different questions, skips excluded ones and stops at the pool size', () => {
    const pool = ['a', 'b', 'c', 'd'].map((id) => q(id));
    const got = pickTriviaQuestions(pool, 3, mulberry32(1), new Set(['b']));
    expect(got).toHaveLength(3);
    expect(got.map((x) => x.id)).not.toContain('b');
    expect(pickTriviaQuestions(pool, 10, mulberry32(1))).toHaveLength(4);
  });
});
