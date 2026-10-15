import { describe, expect, it } from 'vitest';
import { TRIVIA_SEEN_KEEP, mulberry32 } from '@dozari/shared';
import type { TduelState, TriviaRoundQuestion } from '@dozari/shared';
import { TriviaDuelService } from '../realtime/trivia-duel.js';
import { createMemoryTriviaSeenStore, drawTrivia } from '../trivia/seen.js';
import { TriviaService } from '../trivia/service.js';
import { createMemoryTriviaStore } from '../trivia/store.js';

const FOOD = '00000000-0000-7000-d000-000000000001';
const TOOLS = '00000000-0000-7000-d000-000000000002';

async function bank(foodCount: number, toolsCount = 0) {
  const store = createMemoryTriviaStore({ [FOOD]: 'خوراکی', [TOOLS]: 'ابزار' });
  const add = async (topicId: string, n: number) => {
    for (let i = 0; i < n; i++) await store.create({ topicId, textFa: `پرسش ${topicId.slice(-1)}-${i}؟`, options: [`الف${i}`, `ب${i}`, `ج${i}`, `د${i}`], correctIndex: 1, explanationFa: '', ageTrack: 'adult', difficulty: 2 }, 'approved');
  };
  await add(FOOD, foodCount);
  await add(TOOLS, toolsCount);
  return store;
}

describe('question memory', () => {
  it('a solo player never meets a question twice while the topic has enough unseen ones', async () => {
    const store = await bank(24);
    const seen = createMemoryTriviaSeenStore();
    const svc = new TriviaService(store, { perGame: async () => 8, seen, newSeed: (() => { let n = 0; return () => ++n; })() });
    const ids = new Set<string>();
    for (let g = 0; g < 3; g++) {
      const view = await svc.start({ userId: 'p', topicId: FOOD, tracks: ['adult'] });
      if (!view || view === 'insufficient_coins') throw new Error('no game');
      for (const r of view.rounds) {
        expect(ids.has(r.textFa)).toBe(false); // a question text is unique per question in this bank
        ids.add(r.textFa);
        await svc.answer(view.sessionId, r.index, 0);
      }
    }
    expect(ids.size).toBe(24);
    // 24 questions are all used up: the 4th game starts over from the oldest instead of failing
    const again = await svc.start({ userId: 'p', topicId: FOOD, tracks: ['adult'] });
    expect(again && again !== 'insufficient_coins' && again.rounds.length).toBe(8);
  });

  it('only answered questions count as seen, and a guest keeps no memory', async () => {
    const store = await bank(16);
    const seen = createMemoryTriviaSeenStore();
    const svc = new TriviaService(store, { perGame: async () => 8, seen, newSeed: () => 5 });
    const view = await svc.start({ userId: 'p', topicId: FOOD, tracks: ['adult'] });
    if (!view || view === 'insufficient_coins') throw new Error('no game');
    await svc.answer(view.sessionId, 0, 0);
    await svc.answer(view.sessionId, 1, 0);
    await Promise.resolve();
    expect(seen.rows.get('p')?.size).toBe(2);
    await svc.start({ topicId: FOOD, tracks: ['adult'] });
    expect(seen.rows.size).toBe(1);
  });

  it('a mixed draw and a themed draw also prefer unseen questions, and a chosen topic is never padded from others', async () => {
    const store = await bank(10, 10);
    const seen = createMemoryTriviaSeenStore();
    await seen.mark('p', [...(await store.approved({ topicId: FOOD, tracks: ['adult'], limit: 99 }))].slice(0, 8).map((q) => q.id), 1000);
    const mix = await drawTrivia(store, seen, { tracks: ['adult'], count: 12, rng: mulberry32(2), userIds: ['p'] });
    const seenIds = new Set([...(seen.rows.get('p') ?? new Map()).keys()]);
    expect(mix.filter((q) => seenIds.has(q.id))).toHaveLength(0); // 12 unseen exist (2 food + 10 tools)
    const topic = await drawTrivia(store, seen, { topicId: FOOD, tracks: ['adult'], count: 8, rng: mulberry32(2), userIds: ['p'] });
    expect(topic.every((q) => q.topicId === FOOD)).toBe(true);
    const themed = await drawTrivia(store, seen, { topicIds: [FOOD], tracks: ['adult'], count: 14, rng: mulberry32(2), userIds: ['p'] });
    expect(themed).toHaveLength(14); // 10 food + 4 padded from the rest of the bank
  });

  it('keeps only the newest questions per player', async () => {
    const seen = createMemoryTriviaSeenStore();
    const ids = Array.from({ length: TRIVIA_SEEN_KEEP + 20 }, (_, i) => `q${i}`);
    for (const [i, id] of ids.entries()) await seen.mark('p', [id], i);
    const m = await seen.seen('p');
    expect(m.size).toBe(TRIVIA_SEEN_KEEP);
    expect(m.has('q0')).toBe(false);
    expect(m.has(`q${ids.length - 1}`)).toBe(true);
  });
});

describe('question duel memory', () => {
  const q = (id: string): TriviaRoundQuestion => ({ id, textFa: id, options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanationFa: '' });
  it('asks the draw to prefer what both humans have not seen (a bot is not counted) and marks each revealed question for them', async () => {
    const asked: readonly string[][] = [];
    const marks: string[] = [];
    const emitted: { to: string; payload: unknown }[] = [];
    const svc = new TriviaDuelService({
      emit: (to, event, payload) => void (event === 'tduel:state' && emitted.push({ to, payload })),
      profile: async (id) => ({ nickname: id, avatarKey: 'a', level: 1, coins: 0 }),
      questions: async ({ userIds, count }) => {
        (asked as string[][]).push([...userIds]);
        return [q('1'), q('2'), q('3')].slice(0, count);
      },
      topicName: async () => null,
      settings: async () => ({ questions: 3, seconds: 10 }),
      isBot: (id) => id === 'bot',
      markSeen: (users, qid) => void marks.push(`${[...users].join('+')}:${qid}`),
      introMs: 0,
      schedule: () => () => undefined,
    });
    await svc.join('a');
    expect(await svc.startWithBot('a', 'bot')).toBe(true);
    expect(asked.at(-1)).toEqual(['a']);
    svc.answer('a', 0);
    svc.answer('bot', 0);
    expect(marks).toEqual(['a:1']);
    expect((emitted.at(-1)?.payload as TduelState).round.revealed).toHaveLength(1);
  });
});
