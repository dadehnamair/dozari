import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { SoloService } from '../solo/service.js';
import type { PuzzleSource, ServedPuzzle } from '../solo/types.js';

const puzzle: ServedPuzzle = {
  id: 'pz1',
  groups: ([0, 1, 2, 3] as const).map((level) => ({
    level,
    productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`),
    titleFa: `عنوان ${level}`,
    explanationFa: `توضیح ${level}`,
  })),
  items: Object.fromEntries(
    [0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].map((i) => [`g${l}p${i}`, { nameFa: `کالا ${l}-${i}`, unitFa: i === 0 ? 'یک عدد' : null }])),
  ),
};
const ids = (level: number) => puzzle.groups[level]!.productIds as string[];

const prices: PuzzleSource['pricesFor'] = async (ids) =>
  Object.fromEntries(ids.map((id) => [id, [{ year: 1375, month: null, priceRials: 1000n }, { year: 1380, month: null, priceRials: 5000n }]]));

function setup(src: PuzzleSource = { pickRandom: async () => puzzle, pricesFor: prices }, now = () => 1_000) {
  const solo = new SoloService(src, { now, newSeed: () => 7, ttlMs: 10_000 });
  return { solo, app: buildServer({ solo }) };
}

describe('SoloService redaction', () => {
  it('never exposes groups, titles or card order hints for unsolved groups', async () => {
    const { solo } = setup();
    const view = (await solo.start())!;
    const json = JSON.stringify(view);
    expect(view.cards).toHaveLength(16);
    expect(view.solved).toEqual([]);
    expect(json).not.toContain('عنوان');
    expect(json).not.toContain('توضیح');
    expect(view).not.toHaveProperty('groups');
    expect(Object.keys(view.cards[0]!).sort()).toEqual(['id', 'nameFa', 'unitFa']);
  });

  it('reveals a group title only once it is solved', async () => {
    const { solo } = setup();
    const view = (await solo.start())!;
    const r = solo.guess(view.sessionId, ids(2))!;
    expect(r.outcome).toBe('correct');
    expect(r.view.solved).toEqual([{ level: 2, titleFa: 'عنوان 2', explanationFa: 'توضیح 2', productIds: ids(2), revealed: false }]);
    expect(JSON.stringify(r.view)).not.toContain('عنوان 0');
    expect(r.view.cards).toHaveLength(12);
  });

  it('plays a full game to a win and to a loss', async () => {
    const { solo } = setup();
    const won = (await solo.start())!;
    for (const l of [0, 1, 2]) solo.guess(won.sessionId, ids(l));
    const end = solo.view(won.sessionId)!;
    expect(end.status).toBe('won');
    expect(end.solved.map((g) => g.revealed)).toEqual([false, false, false, true]);

    const lost = (await solo.start())!;
    const wrong = [[ids(0)[0]!, ids(0)[1]!, ids(1)[0]!, ids(1)[1]!], [ids(0)[0]!, ids(0)[2]!, ids(1)[0]!, ids(1)[2]!], [ids(0)[0]!, ids(0)[3]!, ids(1)[0]!, ids(1)[3]!], [ids(0)[1]!, ids(0)[2]!, ids(1)[1]!, ids(1)[2]!]];
    for (const w of wrong) solo.guess(lost.sessionId, w);
    const over = solo.view(lost.sessionId)!;
    expect(over.status).toBe('lost');
    expect(over.mistakes).toBe(4);
    expect(over.solved).toHaveLength(4);
  });

  it('drops idle sessions', async () => {
    let t = 1_000;
    const { solo } = setup(undefined, () => t);
    const v = (await solo.start())!;
    t += 5_000;
    expect(solo.view(v.sessionId)).not.toBeNull();
    t += 20_000;
    expect(solo.view(v.sessionId)).toBeNull();
  });

  it('shuffle only reorders', async () => {
    const { solo } = setup();
    const v = (await solo.start())!;
    const s = solo.shuffle(v.sessionId)!;
    expect(s.cards.map((c) => c.id).sort()).toEqual(v.cards.map((c) => c.id).sort());
  });
});

describe('solo routes', () => {
  it('start -> guess flow over HTTP', async () => {
    const { app } = setup();
    const start = await app.inject({ method: 'POST', url: '/solo/start' });
    expect(start.statusCode).toBe(200);
    const view = start.json();
    const good = await app.inject({ method: 'POST', url: `/solo/${view.sessionId}/guess`, payload: { productIds: ids(0) } });
    expect(good.statusCode).toBe(200);
    expect(good.json().outcome).toBe('correct');
    const dup = await app.inject({ method: 'POST', url: `/solo/${view.sessionId}/guess`, payload: { productIds: ids(0) } });
    expect(dup.json().outcome).toBe('invalid'); // those cards are off the board now
    const get = await app.inject({ method: 'GET', url: `/solo/${view.sessionId}` });
    expect(get.json().solved).toHaveLength(1);
    const sh = await app.inject({ method: 'POST', url: `/solo/${view.sessionId}/shuffle` });
    expect(sh.statusCode).toBe(200);
  });

  it('503 without puzzles, 400 on bad input, 404 on unknown session', async () => {
    const empty = setup({ pickRandom: async () => null, pricesFor: prices });
    expect((await empty.app.inject({ method: 'POST', url: '/solo/start' })).statusCode).toBe(503);
    const { app } = setup();
    const unknown = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
    expect((await app.inject({ method: 'GET', url: '/solo/nope' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: `/solo/${unknown}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: `/solo/${unknown}/guess`, payload: { productIds: ['a'] } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: `/solo/${unknown}/guess`, payload: { productIds: ['a', 'b', 'c', 'd'] } })).statusCode).toBe(404);
  });
});

describe('chart endpoint', () => {
  it('refuses while playing (would reveal the groups) and serves once the game is over', async () => {
    const { solo, app } = setup();
    const v = (await solo.start())!;
    const early = await app.inject({ method: 'GET', url: `/solo/${v.sessionId}/chart` });
    expect(early.statusCode).toBe(409);
    for (const l of [0, 1, 2]) solo.guess(v.sessionId, ids(l));
    const done = await app.inject({ method: 'GET', url: `/solo/${v.sessionId}/chart` });
    expect(done.statusCode).toBe(200);
    const body = done.json();
    expect(body.groups).toHaveLength(4);
    expect(body.groups[0].items).toHaveLength(4);
    expect(body.groups[0].items[0].points[0]).toEqual({ year: 1375, month: null, priceRials: '1000' });
    const { soloChartSchema } = await import('@dozari/shared');
    expect(soloChartSchema.safeParse(body).success).toBe(true);
  });

  it('404 for an unknown session', async () => {
    const { app } = setup();
    const unknown = await app.inject({ method: 'GET', url: '/solo/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/chart' });
    expect(unknown.statusCode).toBe(404);
  });
});

describe('wire contract', () => {
  it('server views parse with the shared schema', async () => {
    const { soloGuessResultSchema, soloViewSchema } = await import('@dozari/shared');
    const { solo } = setup();
    const v = (await solo.start())!;
    expect(soloViewSchema.safeParse(v).success).toBe(true);
    expect(soloGuessResultSchema.safeParse(solo.guess(v.sessionId, ids(1))).success).toBe(true);
  });
});

describe('cors', () => {
  it('is off by default and on when configured', async () => {
    const off = await buildServer().inject({ method: 'OPTIONS', url: '/health', headers: { origin: 'http://x', 'access-control-request-method': 'GET' } });
    expect(off.headers['access-control-allow-origin']).toBeUndefined();
    const on = await buildServer({ corsOrigin: 'http://x' }).inject({ method: 'OPTIONS', url: '/health', headers: { origin: 'http://x', 'access-control-request-method': 'GET' } });
    expect(on.headers['access-control-allow-origin']).toBe('http://x');
  });
});
