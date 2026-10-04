import { describe, expect, it } from 'vitest';
import { FeedbackService, normalizeName } from '../feedback/service.js';
import type { FeedbackRules } from '../feedback/service.js';
import { createMemoryFeedbackStore } from '../feedback/store.js';

const A = '0190a2c0-0000-7000-8000-00000000000a';
const B = '0190a2c0-0000-7000-8000-00000000000b';
const C = '0190a2c0-0000-7000-8000-00000000000c';
const PUFAK = '0190a2c0-0000-7000-8000-0000000000f1';

function setup(over: Partial<FeedbackRules> = {}, games = 20) {
  const clock = { t: 1_700_000_000_000 };
  const paid: { userId: string; id: string; coins: number }[] = [];
  const catalog = { products: [] as string[], prices: [] as { productId: string; year: number; priceRials: bigint }[] };
  const rules: FeedbackRules = { dailyLimit: 3, voterMinGames: 10, approveScore: 2, rejectScore: 2, rewardCoins: 30, reportDailyLimit: 2, ...over };
  const svc = new FeedbackService({
    store: createMemoryFeedbackStore(() => clock.t),
    rules: async () => rules,
    games: async () => games,
    userExists: async (id) => [A, B, C].includes(id),
    products: async () => [{ id: PUFAK, nameFa: 'پفک نمکی' }],
    reward: async (userId, id, coins) => void paid.push({ userId, id, coins }),
    catalog: {
      createProduct: async (p) => (catalog.products.push(p.nameFa), { id: 'new-product' }),
      addPrice: async (p) => (catalog.prices.push({ productId: p.productId, year: p.year, priceRials: p.priceRials }), { id: 'price-1' }),
    },
    now: () => clock.t,
  });
  return { svc, clock, paid, catalog };
}

describe('reports', () => {
  it('records one report per target, not of oneself, within the daily limit', async () => {
    const { svc } = setup();
    expect(await svc.report(A, { targetId: A, category: 'abuse', details: '' })).toBe('self');
    expect(await svc.report(A, { targetId: '0190a2c0-0000-7000-8000-0000000000ee', category: 'abuse', details: '' })).toBe('unknown_user');
    expect(await svc.report(A, { targetId: B, category: 'abuse', details: 'فحش داد' })).toBe('ok');
    expect(await svc.report(A, { targetId: B, category: 'spam', details: '' })).toBe('duplicate');
    expect(await svc.report(A, { targetId: C, category: 'cheating', details: '' })).toBe('ok');
    expect((await svc.reports()).length).toBe(2);
  });

  it('refuses past the daily limit and allows again the next day', async () => {
    const { svc, clock } = setup({ reportDailyLimit: 1 });
    expect(await svc.report(A, { targetId: B, category: 'abuse', details: '' })).toBe('ok');
    const [first] = await svc.reports();
    await svc.resolveReport(first!.id);
    expect(await svc.report(A, { targetId: C, category: 'abuse', details: '' })).toBe('limit');
    clock.t += 25 * 3_600_000;
    expect(await svc.report(A, { targetId: C, category: 'abuse', details: '' })).toBe('ok');
  });
});

describe('suggestions', () => {
  const item = { kind: 'item' as const, nameFa: 'شکلات هوپر', category: 'snack', year: 1375, price: 50, unit: 'toman' as const, sourceType: 'user_memory' as const, sourceText: 'یادمه', note: '' };

  it('stores rials, spots an existing item by normalized name, and limits per day', async () => {
    const { svc } = setup();
    expect(await svc.submit(A, { ...item, nameFa: 'پفک‌نمکی' })).toEqual({ ok: false, error: 'duplicate', productId: PUFAK });
    const ok = await svc.submit(A, item);
    expect(ok.ok).toBe(true);
    expect(await svc.submit(A, { kind: 'price_point', productId: '0190a2c0-0000-7000-8000-0000000000aa', year: 1380, price: 5, unit: 'toman', sourceType: 'website', sourceText: '', note: '' })).toEqual({ ok: false, error: 'unknown_product' });
    await svc.submit(A, { ...item, nameFa: 'آدامس یک' });
    await svc.submit(A, { ...item, nameFa: 'آدامس دو' });
    expect(await svc.submit(A, { ...item, nameFa: 'آدامس سه' })).toEqual({ ok: false, error: 'limit' });
    const [row] = await svc.list('pending');
    expect(row!.priceRials).toBeTypeOf('number');
  });

  it('votes: one per player, not your own, gated by finished games; score moves the state', async () => {
    const { svc } = setup();
    const made = await svc.submit(A, item);
    const id = (made as { id: string }).id;
    expect(await svc.vote(A, id, 1)).toEqual({ ok: false, error: 'own' });
    expect(await svc.vote(B, id, 1)).toEqual({ ok: true, status: 'pending' });
    expect(await svc.vote(B, id, 1)).toEqual({ ok: false, error: 'voted' });
    expect(await svc.vote(C, id, 1)).toEqual({ ok: true, status: 'ready_for_review' });
    expect(await svc.vote(C, id, 1)).toEqual({ ok: false, error: 'closed' });
    const low = setup({}, 3);
    const m = await low.svc.submit(A, item);
    expect(await low.svc.vote(B, (m as { id: string }).id, 1)).toEqual({ ok: false, error: 'locked' });
    expect(await low.svc.feed(B)).toEqual({ locked: true, need: 10 });
  });

  it('rejects on negative score and the feed skips voted and own cards', async () => {
    const { svc } = setup();
    const id = ((await svc.submit(A, item)) as { id: string }).id;
    expect(await svc.feed(A)).toEqual({ locked: false, card: null });
    expect((await svc.feed(B) as { card: { id: string } }).card.id).toBe(id);
    await svc.vote(B, id, -1);
    expect(await svc.feed(B)).toEqual({ locked: false, card: null });
    expect(await svc.vote(C, id, -1)).toEqual({ ok: true, status: 'rejected' });
  });

  it('approving an item hands product and price to the catalog and pays the reward once', async () => {
    const { svc, paid, catalog } = setup();
    const id = ((await svc.submit(A, item)) as { id: string }).id;
    expect(await svc.approve(id)).toEqual({ ok: true, productId: 'new-product' });
    expect(catalog.products).toEqual(['شکلات هوپر']);
    expect(catalog.prices).toEqual([{ productId: 'new-product', year: 1375, priceRials: 500n }]);
    expect(await svc.approve(id)).toEqual({ ok: false, error: 'closed' });
    expect(paid).toEqual([{ userId: A, id, coins: 30 }]);
  });

  it('a price report approves without touching the catalog; reject pays nothing', async () => {
    const { svc, paid, catalog } = setup();
    const r = await svc.submit(B, { kind: 'price_report', productId: PUFAK, note: 'قیمتش غلطه', unit: 'toman', sourceType: 'user_memory', sourceText: '' });
    expect(r.ok).toBe(true);
    const x = await svc.submit(B, { kind: 'price_point', productId: PUFAK, year: 1390, price: 12, unit: 'toman', sourceType: 'website', sourceText: '', note: '' });
    expect(await svc.reject((x as { id: string }).id)).toEqual({ ok: true });
    expect(await svc.approve((r as { id: string }).id)).toEqual({ ok: true, productId: PUFAK });
    expect(catalog.prices).toEqual([]);
    expect(paid.length).toBe(1);
  });
});

describe('normalizeName', () => {
  it('ignores spacing, ZWNJ and Arabic letter forms', () => {
    expect(normalizeName('پفك نمكي')).toBe(normalizeName('پفک‌نمکی'));
  });
});
