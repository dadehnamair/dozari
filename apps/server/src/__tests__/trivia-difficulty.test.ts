import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@dozari/shared';
import type { TriviaRoundQuestion } from '@dozari/shared';
import { buildServer } from '../index.js';
import { createMemoryAuditLog } from '../admin/audit.js';
import { TriviaDuelService } from '../realtime/trivia-duel.js';
import { drawTrivia } from '../trivia/seen.js';
import { TriviaService } from '../trivia/service.js';
import { createMemoryTriviaStore } from '../trivia/store.js';

const FOOD = '00000000-0000-7000-d000-000000000001';
const TOKEN = 'secret-admin-token';

async function bank(perLevel = 6) {
  const store = createMemoryTriviaStore({ [FOOD]: 'خوراکی' });
  for (const difficulty of [1, 2, 3]) {
    for (let i = 0; i < perLevel; i++) await store.create({ topicId: FOOD, textFa: `پرسش سطح ${difficulty} شماره ${i}؟`, options: [`الف${i}`, `ب${i}`, `ج${i}`, `د${i}`], correctIndex: 1, explanationFa: '', ageTrack: 'adult', difficulty }, 'approved');
  }
  return store;
}

describe('level matching', () => {
  it('prefers the difficulty that fits among equally unseen questions, and never at the cost of repeats', async () => {
    const store = await bank(6);
    const pickDiffs = async (target: number) => (await drawTrivia(store, undefined, { topicId: FOOD, tracks: ['adult'], count: 6, rng: mulberry32(4), userIds: [], target })).map((q) => q.difficulty);
    expect(await pickDiffs(1)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(await pickDiffs(3)).toEqual([3, 3, 3, 3, 3, 3]);
    // 8 wanted but only 6 of the target exist: the nearest difficulty fills the rest
    const mix = (await drawTrivia(store, undefined, { topicId: FOOD, tracks: ['adult'], count: 8, rng: mulberry32(4), userIds: [], target: 2 })).map((q) => q.difficulty);
    expect(mix.filter((d) => d === 2)).toHaveLength(6);
    // without a target it is a plain random draw over all levels
    const plain = new Set((await drawTrivia(store, undefined, { topicId: FOOD, tracks: ['adult'], count: 12, rng: mulberry32(4), userIds: [] })).map((q) => q.difficulty));
    expect(plain.size).toBe(3);
  });

  it('a solo game follows the target that the service is given', async () => {
    const store = await bank(6);
    const svc = new TriviaService(store, { perGame: async () => 4, newSeed: () => 2, targetFor: async () => 3 });
    const view = await svc.start({ userId: 'p', topicId: FOOD, tracks: ['adult'] });
    if (!view || view === 'insufficient_coins') throw new Error('no game');
    expect(view.rounds.every((r) => r.textFa.includes('سطح 3'))).toBe(true);
  });
});

describe('measured difficulty counters', () => {
  it('counts a solo answer and whether it was right', async () => {
    const store = await bank(1);
    const seen: { id: string; right: boolean }[] = [];
    const svc = new TriviaService(store, { perGame: async () => 3, newSeed: () => 2, recordAnswer: (id, right) => { seen.push({ id, right }); void store.recordAnswers(id, 1, right ? 1 : 0); } });
    const view = await svc.start({ userId: 'p', tracks: ['adult'] });
    if (!view || view === 'insufficient_coins') throw new Error('no game');
    for (const r of view.rounds) await svc.answer(view.sessionId, r.index, 0);
    await svc.answer(view.sessionId, 0, 1); // answering again changes nothing
    expect(seen).toHaveLength(3);
    expect(store.rows.reduce((a, r) => a + r.plays, 0)).toBe(3);
    expect(store.rows.reduce((a, r) => a + r.rightCount, 0)).toBe(seen.filter((x) => x.right).length);
  });

  it('a question duel reports only the humans\' answers when a question is revealed', async () => {
    const reports: { questionId: string; answers: number; right: number }[] = [];
    const q = (id: string): TriviaRoundQuestion => ({ id, textFa: id, options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanationFa: '' });
    const svc = new TriviaDuelService({
      emit: () => undefined,
      profile: async (id) => ({ nickname: id, avatarKey: 'a', level: 1, coins: 0 }),
      questions: async () => [q('1'), q('2')],
      topicName: async () => null,
      settings: async () => ({ questions: 2, seconds: 10 }),
      isBot: (id) => id === 'bot',
      onRevealed: (r) => void reports.push(r),
      introMs: 0,
      schedule: () => () => undefined,
    });
    await svc.join('a');
    await svc.startWithBot('a', 'bot');
    svc.answer('a', 0);
    svc.answer('bot', 3);
    svc.answer('a', 2);
    svc.answer('bot', 2);
    expect(reports).toEqual([{ questionId: '1', answers: 1, right: 1 }, { questionId: '2', answers: 1, right: 0 }]);
  });
});

describe('admin: difficulty', () => {
  it('stores it, lists it with the measured value, and changes it alone', async () => {
    const store = createMemoryTriviaStore({ [FOOD]: 'خوراکی' });
    const service = new TriviaService(store, {});
    const app = buildServer({ trivia: { service }, admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: TOKEN }, adminModules: { audit: createMemoryAuditLog(), trivia: store } });
    const h = { 'x-admin-token': TOKEN };
    const body = { topicId: FOOD, textFa: 'پرسش آزمایشی شماره یک؟', options: ['الف', 'ب', 'ج', 'د'], correctIndex: 1, explanationFa: '' };
    expect((await app.inject({ method: 'POST', url: '/admin/trivia', headers: h, payload: { ...body, difficulty: 5 } })).statusCode).toBe(400);
    const id = ((await app.inject({ method: 'POST', url: '/admin/trivia', headers: h, payload: { ...body, difficulty: 3 } })).json() as { id: string }).id;
    expect(store.rows[0]?.difficulty).toBe(3);
    await store.recordAnswers(id, 40, 36); // 90 % right: players find it easy
    const list = (await app.inject({ method: 'GET', url: '/admin/trivia?status=approved', headers: h })).json() as { questions: { id: string; difficulty: number; plays: number; measured: number | null }[] };
    expect(list.questions[0]).toMatchObject({ id, difficulty: 3, plays: 40, measured: 1 });
    expect((await app.inject({ method: 'PATCH', url: `/admin/trivia/${id}`, headers: h, payload: { difficulty: 1 } })).statusCode).toBe(200);
    expect(store.rows[0]?.difficulty).toBe(1);
    expect((await app.inject({ method: 'PATCH', url: `/admin/trivia/${id}`, headers: h, payload: {} })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: `/admin/trivia/00000000-0000-7000-e000-0000000000ff`, headers: h, payload: { difficulty: 2 } })).statusCode).toBe(404);
  });
});
