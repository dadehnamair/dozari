import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { AiStudio } from '../ai/studio.js';
import { extractJson, buildPrompt, generateRequestSchema, parseDrafts, repeatsExisting } from '../ai/content.js';
import { resolveProviders, chat, cleanAnswer, listModels } from '../ai/providers.js';
import type { FetchLike } from '../ai/providers.js';
import type { ProductAdmin } from '../admin/products.js';
import type { LessonStore } from '../lessons/service.js';
import type { PuzzleAdmin } from '../puzzles/admin.js';
import { createMemoryAuditLog } from '../admin/audit.js';

const TOKEN = 'secret-admin-token';
const h = { 'x-admin-token': TOKEN };
const PID = '0190a000-0000-7000-8000-000000000001';

const answer = (content: string): FetchLike => async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) });

function setup(content: string, fetchImpl?: FetchLike) {
  const seen: { url?: string; auth?: string; body?: { model: string; messages: { content: string }[] } } = {};
  const spy: FetchLike = async (url, init) => {
    seen.url = url;
    seen.auth = init.headers.authorization;
    seen.body = JSON.parse(init.body ?? '{}');
    return (fetchImpl ?? answer(content))(url, init);
  };
  const saved: unknown[] = [];
  const products: ProductAdmin = {
    details: async () => ({}),
    update: async (id, patch) => (saved.push(['update', id, patch]), 'ok'),
    create: async (input) => (saved.push(['create', input.slug]), input.slug === 'taken' ? 'duplicate' : { id: PID }),
    addPrice: async () => ({ id: PID }),
  };
  const lessons = {
    listKidItems: async () => [{ productId: PID, nameFa: 'سیب', iconKey: null, lesson: null }],
    save: async (id: string, input: unknown) => (saved.push(['lesson', id, input]), true),
  } as unknown as LessonStore;
  const puzzles = {
    list: async () => [{ id: 'pz1', groups: [0, 1, 2, 3].map((level) => ({ level, titleFa: null, items: ['الف', 'ب', 'پ', 'ت'] })) }],
    setTitles: async (id: string, titles: unknown) => (saved.push(['titles', id, titles]), 'ok'),
  } as unknown as PuzzleAdmin;
  const studio = new AiStudio({ env: { AI_DEEPSEEK_API_KEY: 'sk-test-key' }, products, lessons, puzzles, fetch: spy });
  const audit = createMemoryAuditLog();
  const app = buildServer({ admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: TOKEN }, adminModules: { ai: studio, audit } });
  return { app, studio, seen, saved, audit };
}

describe('AI studio', () => {
  it('only offers providers that have a key and never exposes the key', async () => {
    const { app } = setup('{}');
    const res = await app.inject({ method: 'GET', url: '/admin/ai', headers: h });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ providers: [{ id: 'deepseek', defaultModel: 'deepseek-chat' }] });
    expect(res.body).not.toContain('sk-test-key');
    expect(resolveProviders({ AI_CUSTOM_BASE_URL: 'https://gw.example/v1/', AI_CUSTOM_API_KEY: 'k', AI_CUSTOM_NAME: 'گیت‌وی' }).map((p) => [p.id, p.baseUrl])).toEqual([['custom', 'https://gw.example/v1']]);
    expect(resolveProviders({ AI_CUSTOM_BASE_URL: 'ftp://x', AI_CUSTOM_API_KEY: 'k' })).toEqual([]);
  });

  it('generates product drafts: validated, deduplicated, tagged with the age track', async () => {
    const json = '```json\n' + JSON.stringify({ items: [
      { slug: 'sib', nameFa: 'سیب', unitFa: 'عدد', category: 'food', storyFa: 'سیب سرخ' },
      { slug: 'sib', nameFa: 'سیب دوباره', unitFa: null, category: 'food' },
      { slug: 'bad slug', nameFa: 'x', category: 'food' },
      { slug: 'toop', nameFa: 'توپ', category: 'nope' },
    ] }) + '\n```';
    const { app, seen } = setup(json);
    const res = await app.inject({ method: 'POST', url: '/admin/ai/generate', headers: h, payload: { kind: 'products', provider: 'deepseek', count: 4, ageTrack: 'kid', hint: 'میوه' } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { drafts: { slug: string; ageTrack: string }[]; dropped: number; model: string };
    expect(body.drafts).toEqual([expect.objectContaining({ slug: 'sib', ageTrack: 'kid' })]);
    expect(body.dropped).toBe(3);
    expect(body.model).toBe('deepseek-chat');
    expect(seen.url).toBe('https://api.deepseek.com/v1/chat/completions');
    expect(seen.auth).toBe('Bearer sk-test-key');
    expect(seen.body?.messages[1]?.content).toContain('Suggest 4');
    expect(seen.body?.messages[1]?.content).toContain('children');
  });

  it('only accepts lesson drafts for the items it asked about, and titles for real levels', async () => {
    const lessons = JSON.stringify({ items: [{ productId: PID, wordFa: 'سیب', storyFa: 'سیب خوشمزه است', syllablesFa: 'سی-ب' }, { productId: 'other', wordFa: 'x', storyFa: '' }] });
    const a = setup(lessons);
    const l = (await a.app.inject({ method: 'POST', url: '/admin/ai/generate', headers: h, payload: { kind: 'kid_lessons', provider: 'deepseek', count: 5 } })).json() as { drafts: { productId: string; nameFa: string }[] };
    expect(l.drafts).toHaveLength(1);
    expect(l.drafts[0]).toMatchObject({ productId: PID, nameFa: 'سیب' });
    const b = setup(JSON.stringify({ titles: [{ level: 0, titleFa: 'میوه‌ها' }, { level: 9, titleFa: 'بیخود' }, { level: 0, titleFa: 'تکراری' }] }));
    const t = (await b.app.inject({ method: 'POST', url: '/admin/ai/generate', headers: h, payload: { kind: 'puzzle_titles', provider: 'deepseek', puzzleId: 'pz1' } })).json() as { drafts: unknown[] };
    expect(t.drafts).toEqual([{ level: 0, titleFa: 'میوه‌ها' }]);
  });

  it('maps provider failures to clear errors and enforces the hourly cap', async () => {
    const down = setup('', async () => ({ ok: false, status: 401, json: async () => ({}) }));
    const r = await down.app.inject({ method: 'POST', url: '/admin/ai/generate', headers: h, payload: { kind: 'blog', provider: 'deepseek', topic: 'قیمت نان', count: 1 } });
    expect(r.statusCode).toBe(502);
    expect(r.json()).toEqual({ error: 'ai_http_error', providerStatus: 401 });
    const garbage = setup('این جواب JSON نیست');
    expect((await garbage.app.inject({ method: 'POST', url: '/admin/ai/generate', headers: h, payload: { kind: 'blog', provider: 'deepseek', topic: 'قیمت نان', count: 1 } })).json()).toMatchObject({ error: 'ai_bad_output' });
    expect((await garbage.app.inject({ method: 'POST', url: '/admin/ai/generate', headers: h, payload: { kind: 'blog', provider: 'nope', topic: 'قیمت نان', count: 1 } })).statusCode).toBe(400);
    expect((await garbage.app.inject({ method: 'POST', url: '/admin/ai/generate', headers: h, payload: { kind: 'products', provider: 'deepseek', count: 999 } })).statusCode).toBe(400);
    const quick = setup(JSON.stringify({ items: [{ slug: 'sib', nameFa: 'سیب', category: 'food' }] }));
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await quick.app.inject({ method: 'POST', url: '/admin/ai/generate', headers: h, payload: { kind: 'products', provider: 'deepseek', count: 1 } })).statusCode;
    expect(last).toBe(429);
  });

  it('saves products hidden, lessons as draft, retrying a taken slug, and needs the admin token', async () => {
    const { app, saved, audit } = setup('{}');
    expect((await app.inject({ method: 'POST', url: '/admin/ai/save', payload: {} })).statusCode).toBe(401);
    const res = await app.inject({ method: 'POST', url: '/admin/ai/save', headers: h, payload: { kind: 'products', drafts: [{ slug: 'taken', nameFa: 'نان', category: 'food', storyFa: 'گرم' }] } });
    expect(res.statusCode).toBe(200);
    expect(saved).toEqual([['create', 'taken'], ['create', 'taken-2'], ['update', PID, { isActive: false, storyFa: 'گرم' }]]);
    const l = await app.inject({ method: 'POST', url: '/admin/ai/save', headers: h, payload: { kind: 'kid_lessons', drafts: [{ productId: PID, wordFa: 'سیب', storyFa: 'خوب', syllablesFa: null }] } });
    expect((l.json() as { results: { ok: boolean }[] }).results[0]?.ok).toBe(true);
    expect(audit.entries.map((e) => e.action)).toContain('ai.save');
  });

  it('parses model answers however they are wrapped and builds a Persian-first prompt', () => {
    expect(extractJson('Here you go:\n{"a":1}\nBye')).toEqual({ a: 1 });
    expect(extractJson('nothing')).toBeNull();
    const req = generateRequestSchema.parse({ kind: 'blog', provider: 'x', topic: 'قیمت نان', count: 2, length: 'long', keywords: ['نان'] });
    const p = buildPrompt(req);
    expect(p.system).toContain('Never invent statistics');
    expect(p.user).toContain('1000');
  });

  it('speaks Anthropic natively for Claude and OpenAI-style for Gemini', async () => {
    const [claude, gemini] = resolveProviders({ AI_ANTHROPIC_API_KEY: 'a-key', AI_GEMINI_API_KEY: 'g-key' });
    let seen: { url: string; headers: Record<string, string>; body: { system?: string; messages: { role: string }[] } } | undefined;
    const spy: FetchLike = async (url, init) => {
      seen = { url, headers: init.headers, body: JSON.parse(init.body ?? '{}') };
      return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'سلام' }], choices: [{ message: { content: 'hi' } }] }) };
    };
    const req = { system: 'sys', user: 'u', model: 'm', maxTokens: 10 };
    expect(await chat(claude!, req, spy)).toBe('سلام');
    expect(seen!.url).toBe('https://api.anthropic.com/v1/messages');
    expect(seen!.headers['x-api-key']).toBe('a-key');
    expect(seen!.body.system).toBe('sys');
    expect(seen!.body.messages).toEqual([{ role: 'user', content: 'u' }]);
    expect(await chat(gemini!, req, spy)).toBe('hi');
    expect(seen!.url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(seen!.headers.authorization).toBe('Bearer g-key');
  });

  it('keeps prices on product drafts, drops products already in the catalog, saves prices as pending rials', async () => {
    const text = JSON.stringify({ items: [
      { slug: 'pepsi-can', nameFa: 'پپسی', category: 'food', prices: [{ year: 1375, priceToman: 150 }, { year: 1375, priceToman: 160 }, { year: 99, priceToman: 5 }] },
      { slug: 'new-one', nameFa: 'كیك  تازه', category: 'food', prices: [{ year: 1380, priceToman: 300 }] },
      { slug: 'other', nameFa: 'کیک‌تازه', category: 'food' },
    ] });
    const parsed = parseDrafts('products', text, { existing: [{ slug: 'pepsi', nameFa: 'پپسی' }] });
    expect(parsed?.drafts).toHaveLength(1);
    expect(parsed?.drafts[0]).toMatchObject({ slug: 'new-one', prices: [{ year: 1380, priceToman: 300 }] });

    const added: unknown[] = [];
    const products = {
      details: async () => ({}), update: async () => 'ok' as const,
      create: async (i: { slug: string }) => ({ id: i.slug }),
      addPrice: async (i: { year: number; priceRials: bigint; confidence: number }) => (added.push([i.year, i.priceRials, i.confidence]), { id: 'p' }),
    } as unknown as ProductAdmin;
    const studio = new AiStudio({ env: {}, products, catalog: async () => [{ id: 'x1', slug: 'pepsi', nameFa: 'پپسی' }] });
    const out = await studio.save({ kind: 'products', drafts: [
      { slug: 'pepsi-2', nameFa: 'پپسی', category: 'food', unitFa: null, storyFa: '', ageTrack: 'adult', prices: [] },
      { slug: 'kook', nameFa: 'کوک', category: 'food', unitFa: null, storyFa: '', ageTrack: 'adult', prices: [{ year: 1375, priceToman: 150 }, { year: 1375, priceToman: 1 }] },
    ] });
    expect(out.map((o) => o.ok)).toEqual([false, true]);
    expect(added).toEqual([[1375, 1500n, 1]]);
  });

  it('offers ParsPack and accepts model names with a space', async () => {
    const [pp] = resolveProviders({ AI_PARSPACK_API_KEY: 'k' });
    expect(pp).toMatchObject({ id: 'parspack', baseUrl: 'https://ai.parspack.com/v1', defaultModel: 'Grok 4' });
    let body = '';
    const spy: FetchLike = async (_u, init) => ((body = init.body ?? ''), { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'x' } }] }) });
    expect(await chat(pp!, { system: 's', user: 'u', model: 'Grok 4', maxTokens: 5 }, spy)).toBe('x');
    expect(JSON.parse(body).model).toBe('Grok 4');
    await expect(chat(pp!, { system: 's', user: 'u', model: ' bad', maxTokens: 5 }, spy)).rejects.toMatchObject({ code: 'ai_invalid_model' });
  });

  it('reads answers from reasoning/array shapes and explains an empty one', async () => {
    expect(cleanAnswer('<think>hmm {"a":1}</think>\n{"items":[]}')).toBe('{"items":[]}');
    expect(cleanAnswer([{ type: 'text', text: '{"a":' }, { type: 'text', text: '1}' }])).toBe('{"a":1}');
    expect(extractJson('{"items":[1,2,],}')).toEqual({ items: [1, 2] });
    const [pp] = resolveProviders({ AI_PARSPACK_API_KEY: 'k' });
    const cut: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '' }, finish_reason: 'length' }] }) });
    await expect(chat(pp!, { system: 's', user: 'u', model: 'm', maxTokens: 5 }, cut)).rejects.toMatchObject({ code: 'ai_bad_output', detail: expect.stringContaining('سقف') });
  });

  it('lists chat models of a provider (OpenAI and Anthropic shapes), hiding non-chat ones', async () => {
    const [pp, claude] = [resolveProviders({ AI_PARSPACK_API_KEY: 'k' })[0]!, resolveProviders({ AI_ANTHROPIC_API_KEY: 'a' })[0]!];
    const urls: string[] = [];
    const f: FetchLike = async (url, init) => (urls.push(`${init.method} ${url}`), { ok: true, status: 200, json: async () => ({ data: [{ id: 'Grok 4' }, { id: 'text-embedding-3' }, { id: 'models/gpt-4o' }, { id: 'bad id!' }] }) });
    expect(await listModels(pp, f)).toEqual(['gpt-4o', 'Grok 4']);
    await listModels(claude, f);
    expect(urls[0]).toBe('GET https://ai.parspack.com/v1/models');
    expect(urls[1]).toBe('GET https://api.anthropic.com/v1/models?limit=100');
    expect(await listModels(pp, async () => ({ ok: false, status: 401, json: async () => ({}) }))).toEqual([]);
  });

  it('builds whole puzzles from catalog numbers and saves them as drafts', async () => {
    const pool = Array.from({ length: 16 }, (_, i) => ({ productId: `p${i}`, nameFa: `کالا ${i + 1}` }));
    const group = (level: number) => ({ level, titleFa: `گروه ${level}`, explanationFa: 'همه یک چیزند', items: [0, 1, 2, 3].map((k) => level * 4 + k + 1) });
    const good = { groups: [0, 1, 2, 3].map(group) };
    const dup = { groups: [0, 1, 2, 3].map((l) => ({ ...group(l), items: [1, 2, 3, 4] })) };
    const parsed = parseDrafts('puzzle_groups', JSON.stringify({ puzzles: [good, dup, { groups: [] }] }), { pool });
    expect(parsed?.dropped).toBe(2);
    expect(parsed?.drafts).toHaveLength(1);
    expect((parsed?.drafts[0] as { groups: { items: { productId: string }[] }[] }).groups[1]!.items[0]!.productId).toBe('p4');

    const created: unknown[] = [];
    const puzzles = { create: async (...a: unknown[]) => (created.push(a), { ok: true as const, id: 'z' }) } as unknown as PuzzleAdmin;
    const studio = new AiStudio({ env: {}, puzzles });
    const out = await studio.save({ kind: 'puzzle_groups', drafts: parsed!.drafts as never });
    expect(out).toEqual([{ label: 'پازل 1', ok: true }]);
    const [groups, tier, track, status] = created[0] as [{ productIds: string[] }[], unknown, string, string];
    expect(groups[3]!.productIds).toEqual(['p12', 'p13', 'p14', 'p15']);
    expect([tier, track, status]).toEqual([null, 'adult', 'draft']);
  });
});

describe('puzzle prompt: player level and variety', () => {
  const pool = Array.from({ length: 20 }, (_, i) => ({ productId: `id${i}`, nameFa: `ن${i}` }));
  const req = { kind: 'puzzle_groups', provider: 'x', count: 1, ageTrack: 'adult', style: 'witty' } as never;

  it('asks for different kinds of link and limits price groups, naming the life contexts', () => {
    const { system } = buildPrompt(req, { pool });
    expect(system).toContain('four DIFFERENT kinds of link');
    expect(system).toContain('at most ONE group');
    for (const idea of ['آشپزخونه', 'انباری', 'تعمیرکار', 'مامانم همشو قایم می‌کرد']) expect(system).toContain(idea);
  });

  it('tells the model which players the puzzle is for, by tier level range', () => {
    const novice = buildPrompt(req, { pool, tier: { nameFa: 'خیلی آسان', minLevel: 1, maxLevel: 3 } }).user;
    const expert = buildPrompt(req, { pool, tier: { nameFa: 'خیلی سخت', minLevel: 26, maxLevel: null } }).user;
    expect(novice).toContain('«خیلی آسان» (levels 1–3)');
    expect(novice).toContain('BEGINNERS');
    expect(expert).toContain('level 26 and up');
    expect(expert).toContain('EXPERT');
    expect(buildPrompt(req, { pool }).user).not.toContain('Target players');
  });

  it('saves the puzzles with the chosen tier', async () => {
    const created: unknown[][] = [];
    const puzzles = { create: async (...a: unknown[]) => (created.push(a), { ok: true as const, id: 'z' }) } as unknown as PuzzleAdmin;
    const studio = new AiStudio({ env: {}, puzzles });
    const mk = (l: number) => ({ level: l, titleFa: `گروه ${l}`, explanationFa: 'همه یک چیزند', items: [0, 1, 2, 3].map((k) => ({ productId: `p${l * 4 + k}` })) });
    await studio.save({ kind: 'puzzle_groups', tierId: 'tier-1', drafts: [{ ageTrack: 'adult', groups: [0, 1, 2, 3].map(mk) }] } as never);
    expect(created[0]![1]).toBe('tier-1');
  });

  it('refuses an unknown tier before calling the model', async () => {
    const products = { details: async () => Object.fromEntries(pool.map((p) => [p.productId, { isActive: true, ageTrack: 'adult', category: 'food' }])) } as unknown as ProductAdmin;
    const puzzles = { list: async () => [], tiers: async () => [] } as unknown as PuzzleAdmin;
    const studio = new AiStudio({ env: { AI_DEEPSEEK_API_KEY: 'k' }, products, puzzles, catalog: async () => pool as never, fetch: (async () => { throw new Error('model must not be called'); }) as FetchLike });
    await expect(studio.generate({ ...(req as object), provider: 'deepseek', tierId: 'nope' } as never)).rejects.toMatchObject({ code: 'ai_not_found' });
  });
});

describe('no repeats of what the catalog already has', () => {
  const draftOf = (names: string[][]) => ({
    ageTrack: 'adult' as const,
    groups: names.map((g, level) => ({ level, titleFa: `گروه ${level}`, explanationFa: 'قاعده', items: g.map((n) => ({ productId: n, nameFa: n })) })),
  });
  const four = (p: string) => [1, 2, 3, 4].map((i) => `${p}${i}`);

  it('sends the whole existing product list in the products prompt', () => {
    const existing = Array.from({ length: 900 }, (_, i) => ({ slug: `p${i}`, nameFa: `کالا${i}` }));
    const { user } = buildPrompt({ kind: 'products', provider: 'x', count: 5, ageTrack: 'adult' } as never, { existing });
    expect(user).toContain('EXISTING PRODUCT LIST (900');
    expect(user).toContain('کالا899');
  });

  it('lists existing puzzles in the puzzle prompt', () => {
    const pool = Array.from({ length: 20 }, (_, i) => ({ productId: `id${i}`, nameFa: `ن${i}` }));
    const { user } = buildPrompt({ kind: 'puzzle_groups', provider: 'x', count: 1, ageTrack: 'adult', style: 'plain' } as never, { pool, existingPuzzles: [{ titles: ['نوشیدنی‌های قدیمی'], groups: [] }] });
    expect(user).toContain('EXISTING PUZZLES (1)');
    expect(user).toContain('نوشیدنی‌های قدیمی');
  });

  it('flags a puzzle that repeats a group or 12+ products of an existing one', () => {
    const mine = draftOf([four('a'), four('b'), four('c'), four('d')]);
    expect(repeatsExisting(mine, [{ groups: [four('x'), four('y')] }])).toBe(false);
    expect(repeatsExisting(mine, [{ groups: [four('b'), four('z')] }])).toBe(true); // same group
    expect(repeatsExisting(mine, [{ groups: [[...four('a').slice(0, 2), ...four('b').slice(0, 2)], [...four('c').slice(0, 2), ...four('d').slice(0, 2)], ['q1', 'q2', 'q3', 'q4'], four('a').slice(2)] }])).toBe(false); // 8 shared
    expect(repeatsExisting(mine, [{ groups: [[...four('a').slice(0, 3), 'u1'], [...four('b').slice(0, 3), 'u2'], [...four('c').slice(0, 3), 'u3'], [...four('d').slice(0, 3), 'u4']] }])).toBe(true); // 12 shared
  });
});
