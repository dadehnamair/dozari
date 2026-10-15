import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../game/rng.js';
import { triviaInputSchema } from '../contract.js';
import { pickFreshTrivia, pickTriviaQuestions, shuffleTrivia } from '../logic.js';
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

describe('pickFreshTrivia', () => {
  const pool = Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, topicId: 't', textFa: `سؤال ${i}`, options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanationFa: '' }));
  const seen = (ids: number[], at = 1000) => new Map(ids.map((i) => [`q${i}`, at + i] as const));
  it('never repeats while enough unseen questions exist, over many games', () => {
    const h = new Map<string, number>();
    let t = 1;
    for (let g = 0; g < 2; g++) {
      const got = pickFreshTrivia(pool, 8, mulberry32(g + 1), [h]);
      expect(new Set(got.map((q) => q.id)).size).toBe(8);
      for (const q of got) {
        expect(h.has(q.id)).toBe(false);
        h.set(q.id, t++);
      }
    }
  });
  it('when fewer than count are unseen it takes all of them and fills with the oldest seen', () => {
    const h = seen(Array.from({ length: 16 }, (_, i) => i)); // q0..q15 seen, q0 the oldest; q16..q19 fresh
    const ids = pickFreshTrivia(pool, 8, mulberry32(3), [h]).map((q) => q.id);
    expect(ids).toEqual(expect.arrayContaining(['q16', 'q17', 'q18', 'q19']));
    expect(ids).toEqual(expect.arrayContaining(['q0', 'q1', 'q2', 'q3']));
  });
  it('for two players prefers what neither saw, then what only one saw', () => {
    const a = seen([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const b = seen([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    const ids = pickFreshTrivia(pool, 8, mulberry32(9), [a, b]).map((q) => Number(q.id.slice(1)));
    const neither = [15, 16, 17, 18, 19];
    for (const n of neither) expect(ids).toContain(n);
    const both = [5, 6, 7, 8, 9];
    for (const x of ids) expect(both).not.toContain(x); // the three other picks come from the one-player pile first
  });
  it('treats `avoid` as seen by everybody, newest', () => {
    const ids = pickFreshTrivia(pool, 20, mulberry32(1), [], new Set(['q3', 'q4'])).map((q) => q.id);
    expect(ids.slice(-2).sort()).toEqual(['q3', 'q4']);
  });
  it('is deterministic for a seed and handles an empty pool', () => {
    const h = seen([1, 2]);
    expect(pickFreshTrivia(pool, 5, mulberry32(4), [h]).map((q) => q.id)).toEqual(pickFreshTrivia(pool, 5, mulberry32(4), [h]).map((q) => q.id));
    expect(pickFreshTrivia([], 5, mulberry32(4), [h])).toEqual([]);
  });
});
