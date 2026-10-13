import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { AiStudio } from '../ai/studio.js';
import { buildReviewPrompt, parseReview } from '../ai/puzzle-review.js';
import type { ReviewView } from '../ai/puzzle-review.js';
import type { FetchLike } from '../ai/providers.js';
import type { ProductAdmin } from '../admin/products.js';
import { createMemoryAuditLog } from '../admin/audit.js';
import { createMemoryPuzzleAdmin } from '../puzzles/admin.js';

const TOKEN = 'secret-admin-token';
const h = { 'x-admin-token': TOKEN };
const pid = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const items = Array.from({ length: 30 }, (_, i) => pid(i + 1));
const groupsOf = () => [0, 1, 2, 3].map((level) => ({ level, titleFa: `عنوان ${level + 1}`, explanationFa: 'توضیح', productIds: items.slice(level * 4, level * 4 + 4) }));

const view: ReviewView = { ageTrack: 'adult', groups: groupsOf().map((g) => ({ level: g.level, titleFa: g.titleFa, items: g.productIds.map((productId, i) => ({ productId, nameFa: `کالا ${productId.slice(-2)}-${i}` })) })) };
const cands = items.slice(16).map((productId) => ({ productId, nameFa: `کاندید ${productId.slice(-2)}` }));

describe('puzzle review: prompt and answer reading', () => {
  it('puts the editor extra text and the numbered items in the prompt', () => {
    const p = buildReviewPrompt(view, cands, 'عنوان‌ها را کوتاه کن');
    expect(p.user).toContain('EDITOR\'S EXTRA INSTRUCTIONS');
    expect(p.user).toContain('عنوان‌ها را کوتاه کن');
    expect(p.user).toMatch(/16\. /);
    expect(buildReviewPrompt(view, cands, '').user).not.toContain('EXTRA INSTRUCTIONS');
  });

  it('keeps only real edits: known item/candidate numbers, no repeats, real levels', () => {
    const text = JSON.stringify({ verdict: 'edit', reason: 'ضعیف', titles: [{ level: 1, titleFa: 'عنوان تازه' }, { level: 9, titleFa: 'x' }], swaps: [{ item: 1, candidate: 1 }, { item: 1, candidate: 2 }, { item: 2, candidate: 1 }, { item: 40, candidate: 1 }, { item: 3, candidate: 99 }] });
    const v = parseReview(text, view, cands)!;
    expect(v.verdict).toBe('edit');
    expect(v.titles).toEqual([{ level: 1, titleFa: 'عنوان تازه' }]);
    expect(v.swaps.map((s) => [s.fromProductId, s.toProductId])).toEqual([[items[0], cands[0]!.productId]]);
  });

  it('an edit with nothing usable counts as ok, garbage is null', () => {
    expect(parseReview('{"verdict":"edit","swaps":[{"item":99,"candidate":1}]}', view, cands)?.verdict).toBe('ok');
    expect(parseReview('{"verdict":"ok"}', view, cands)?.verdict).toBe('ok');
    expect(parseReview('hello', view, cands)).toBeNull();
  });
});

function setup(answers: string[]) {
  const puzzles = createMemoryPuzzleAdmin(new Set(items));
  let call = 0;
  const bodies: string[] = [];
  const fetch: FetchLike = async (_u, init) => {
    bodies.push(init.body ?? '');
    const content = answers[Math.min(call++, answers.length - 1)]!;
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
  };
  const products = { details: async () => Object.fromEntries(items.map((id) => [id, { category: 'food', iconKey: null, isActive: true, brand: null, storyFa: null, status: 'approved', ageTrack: 'adult' }])) } as unknown as ProductAdmin;
  const studio = new AiStudio({ env: { AI_DEEPSEEK_API_KEY: 'sk-test-key' }, puzzles, products, catalog: async () => items.map((id) => ({ id, slug: `p${id.slice(-2)}`, nameFa: `کالا ${id.slice(-2)}` })), fetch });
  const app = buildServer({ admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: TOKEN }, adminModules: { ai: studio, puzzles, audit: createMemoryAuditLog() } });
  const make = async () => {
    const out = await puzzles.create(groupsOf(), null, 'adult', 'approved');
    if (!out.ok) throw new Error('create failed');
    return out.id;
  };
  const post = (payload: unknown) => app.inject({ method: 'POST', url: '/admin/ai/puzzle-review', headers: h, payload: payload as Record<string, unknown> });
  return { app, puzzles, make, bodies, post };
}

describe('puzzle review assistant', () => {
  it('edits what needs it and sends that puzzle back to draft; leaves a good one live', async () => {
    const edit = JSON.stringify({ verdict: 'edit', reason: 'یک عنوان ضعیف است', titles: [{ level: 0, titleFa: 'عنوان بهتر' }], swaps: [{ item: 1, candidate: 1, reason: 'مبهم بود' }] });
    const { post, puzzles, make, bodies } = setup([edit, '{"verdict":"ok","reason":"خوب است"}']);
    const a = await make();
    const b = await make();
    const res = await post({ provider: 'deepseek', puzzleIds: [a, b], extra: 'کوتاه‌تر بنویس' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { outcomes: { puzzleId: string; result: string; swaps?: unknown[] }[] };
    expect(body.outcomes.map((o) => o.result)).toEqual(['edited', 'ok']);
    expect(bodies[0]).toContain('کوتاه‌تر بنویس');
    const rows = await puzzles.list(10);
    const ra = rows.find((r) => r.id === a)!;
    expect(ra.status).toBe('draft');
    expect(ra.groups[0]!.titleFa).toBe('عنوان بهتر');
    expect(ra.groups[0]!.productIds[0]).not.toBe(items[0]);
    expect(rows.find((r) => r.id === b)!.status).toBe('approved');
  });

  it('a dry run reports the edit and changes nothing', async () => {
    const edit = JSON.stringify({ verdict: 'edit', reason: 'r', titles: [{ level: 2, titleFa: 'عنوان دیگر' }] });
    const { post, puzzles, make } = setup([edit]);
    const a = await make();
    const res = await post({ provider: 'deepseek', puzzleIds: [a], dryRun: true });
    expect((res.json() as { outcomes: { result: string }[] }).outcomes[0]!.result).toBe('would_edit');
    expect((await puzzles.list(10))[0]).toMatchObject({ status: 'approved' });
    expect((await puzzles.list(10))[0]!.groups[2]!.titleFa).toBe('عنوان 3');
  });

  it('unreadable answers and unknown puzzles are reported per puzzle, not thrown', async () => {
    const { post, make } = setup(['not json']);
    const a = await make();
    const res = await post({ provider: 'deepseek', puzzleIds: [a, pid(900)] });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { outcomes: { result: string; error?: string }[] }).outcomes).toMatchObject([{ result: 'error', error: 'ai_bad_output' }, { result: 'error', error: 'ai_not_found' }]);
  });

  it('refuses a bad request (no ids, too many, too long a note)', async () => {
    const { post } = setup(['{}']);
    expect((await post({ provider: 'deepseek', puzzleIds: [] })).statusCode).toBe(400);
    expect((await post({ provider: 'deepseek', puzzleIds: Array.from({ length: 11 }, (_, i) => pid(i + 1)) })).statusCode).toBe(400);
    expect((await post({ provider: 'deepseek', puzzleIds: [pid(1)], extra: 'x'.repeat(1001) })).statusCode).toBe(400);
  });
});
