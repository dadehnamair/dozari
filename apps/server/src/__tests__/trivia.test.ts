import { describe, expect, it } from 'vitest';
import { triviaInputSchema } from '@dozari/shared';
import { buildServer } from '../index.js';
import { createMemoryAuditLog } from '../admin/audit.js';
import { TriviaService } from '../trivia/service.js';
import { createMemoryTriviaStore } from '../trivia/store.js';

const TOKEN = 'secret-admin-token';
const FOOD = '00000000-0000-7000-d000-000000000001';
const TOOLS = '00000000-0000-7000-d000-000000000002';
const topics = { [FOOD]: 'خوراکی', [TOOLS]: 'ابزار' };
const q = (topicId: string, i: number, extra: object = {}) => ({ topicId, textFa: `پرسش شماره ${i}؟`, options: [`الف${i}`, `ب${i}`, `ج${i}`, `د${i}`], correctIndex: 1, explanationFa: 'چون این‌طور است', ...extra });

function boot() {
  const store = createMemoryTriviaStore(topics);
  const finished: { score: number; total: number }[] = [];
  const service = new TriviaService(store, { newSeed: () => 7, perGame: async () => 3, onFinished: (_u, score, total) => finished.push({ score, total }) });
  const app = buildServer({ trivia: { service }, admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: TOKEN }, adminModules: { audit: createMemoryAuditLog(), trivia: store } });
  return { app, store, finished, h: { 'x-admin-token': TOKEN } };
}

describe('admin: general questions', () => {
  it('needs a topic, four different choices and a real index', async () => {
    const { app, h } = boot();
    const post = (payload: object) => app.inject({ method: 'POST', url: '/admin/trivia', headers: h, payload });
    expect((await post(q(FOOD, 1))).statusCode).toBe(201);
    expect((await post({ ...q(FOOD, 2), topicId: undefined })).statusCode).toBe(400);
    expect((await post(q('00000000-0000-7000-d000-0000000000ff', 3))).statusCode).toBe(400); // unknown topic
    expect((await post(q(FOOD, 4, { options: ['الف', 'الف', 'ج', 'د'] }))).statusCode).toBe(400);
    expect((await post(q(FOOD, 5, { correctIndex: 7 }))).statusCode).toBe(400);
  });

  it('lists by topic and status, edits and retires', async () => {
    const { app, h, store } = boot();
    const id = ((await app.inject({ method: 'POST', url: '/admin/trivia', headers: h, payload: q(FOOD, 1) })).json() as { id: string }).id;
    await app.inject({ method: 'POST', url: '/admin/trivia', headers: h, payload: q(TOOLS, 2) });
    const food = (await app.inject({ method: 'GET', url: `/admin/trivia?topicId=${FOOD}`, headers: h })).json() as { questions: { id: string }[] };
    expect(food.questions.map((x) => x.id)).toEqual([id]);
    expect((await app.inject({ method: 'PUT', url: `/admin/trivia/${id}`, headers: h, payload: q(TOOLS, 9) })).statusCode).toBe(200);
    expect(store.rows.find((r) => r.id === id)?.topicId).toBe(TOOLS);
    expect((await app.inject({ method: 'PATCH', url: `/admin/trivia/${id}`, headers: h, payload: { status: 'retired' } })).statusCode).toBe(200);
    const live = (await app.inject({ method: 'GET', url: '/admin/trivia?status=approved', headers: h })).json() as { questions: unknown[] };
    expect(live.questions).toHaveLength(1);
  });
});

describe('playing general questions', () => {
  async function seeded() {
    const b = boot();
    for (let i = 1; i <= 4; i++) await b.store.create(triviaInputSchema.parse(q(FOOD, i)));
    await b.store.create(triviaInputSchema.parse(q(TOOLS, 9)));
    await b.store.create(triviaInputSchema.parse(q(FOOD, 20, { ageTrack: 'kid' })));
    return b;
  }

  it('lists only topics that have questions for the player\'s track', async () => {
    const { app } = await seeded();
    const t = (await app.inject({ method: 'GET', url: '/trivia/topics' })).json() as { topics: { id: string; questions: number }[] };
    expect(t.topics.find((x) => x.id === FOOD)?.questions).toBe(4); // the kid question is not in the adult pool
    expect(t.topics.find((x) => x.id === TOOLS)?.questions).toBe(1);
  });

  it('starts a game on a topic with shuffled choices and no answer key, then reveals the answer one question at a time', async () => {
    const { app, finished } = await seeded();
    const res = await app.inject({ method: 'POST', url: '/trivia/start', payload: { topicId: FOOD } });
    expect(res.statusCode).toBe(200);
    const view = res.json() as { sessionId: string; topicNameFa: string; rounds: { index: number; options: string[]; textFa: string }[]; results: unknown[] };
    expect(view.topicNameFa).toBe('خوراکی');
    expect(view.rounds).toHaveLength(3);
    expect(res.body).not.toContain('correctIndex');
    expect(res.body).not.toContain('چون این‌طور است');
    expect(view.results).toEqual([]);

    // The right choice is "ب<n>" in the store; find where the shuffle put it.
    let score = 0;
    for (const r of view.rounds) {
      const n = r.textFa.match(/\d+/)![0];
      const right = r.options.indexOf(`ب${n}`);
      const pick = r.index === 0 ? (right + 1) % 4 : right; // miss the first one on purpose
      const ans = await app.inject({ method: 'POST', url: `/trivia/${view.sessionId}/answer`, payload: { index: r.index, picked: pick } });
      const out = ans.json() as { result: { correct: boolean; correctIndex: number; explanationFa: string | null }; view: { done: boolean; score: number } };
      expect(out.result.correctIndex).toBe(right);
      expect(out.result.correct).toBe(r.index !== 0);
      expect(out.result.explanationFa).toBe('چون این‌طور است');
      score = out.view.score;
      if (r.index === 2) expect(out.view.done).toBe(true);
    }
    expect(score).toBe(2);
    expect(finished).toEqual([]); // anonymous games record nothing
  });

  it('a second answer to the same question changes nothing', async () => {
    const { app } = await seeded();
    const view = (await app.inject({ method: 'POST', url: '/trivia/start', payload: {} })).json() as { sessionId: string; rounds: { options: string[] }[] };
    const first = (await app.inject({ method: 'POST', url: `/trivia/${view.sessionId}/answer`, payload: { index: 0, picked: 0 } })).json() as { result: { pickedIndex: number } };
    const again = (await app.inject({ method: 'POST', url: `/trivia/${view.sessionId}/answer`, payload: { index: 0, picked: 3 } })).json() as { result: { pickedIndex: number } };
    expect(again.result.pickedIndex).toBe(first.result.pickedIndex);
    expect((await app.inject({ method: 'POST', url: `/trivia/${view.sessionId}/answer`, payload: { index: 9, picked: 0 } })).statusCode).toBe(404);
  });

  it('says so when there is nothing to ask', async () => {
    const { app } = boot();
    expect((await app.inject({ method: 'POST', url: '/trivia/start', payload: {} })).statusCode).toBe(503);
  });
});
