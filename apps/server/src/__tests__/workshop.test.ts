import { describe, expect, it } from 'vitest';
import { blindOrder } from '@dozari/shared';
import type { WorkshopSubmit } from '@dozari/shared';
import { createMemoryTriviaStore } from '../trivia/store.js';
import { WorkshopService } from '../workshop/service.js';
import type { WorkshopRules } from '../workshop/service.js';
import { createMemoryWorkshopStore } from '../workshop/store.js';

const FOOD = '00000000-0000-7000-d000-000000000001';
const TOOLS = '00000000-0000-7000-d000-000000000002';
const RULES: WorkshopRules = {
  on: true,
  submitDaily: 2,
  reviewDaily: 3,
  reviewMinGames: 5,
  approveScore: 6,
  rejectScore: 5,
  minReviewers: 3,
  agreeBonus: 3,
  milestonePoints: 5,
  milestoneCoins: 10,
  thinBelow: 2,
  author: { coins: 40, firstBonus: 40, milestoneEvery: 5, milestoneBonus: 50, thinBonus: 15, boostPercent: 0 },
};
const q = (n: number, over: Partial<WorkshopSubmit> = {}): WorkshopSubmit => ({ topicId: FOOD, textFa: `پرسش کلمه${n}الف کلمه${n}ب کلمه${n}ج کلمه${n}د کلمه${n}ه؟`, options: [`الف${n}`, `ب${n}`, `ج${n}`, `د${n}`], correctIndex: 1, explanationFa: '', difficulty: 2, ...over });

async function setup(rules: Partial<WorkshopRules> = {}) {
  const trivia = createMemoryTriviaStore({ [FOOD]: 'خوراکی', [TOOLS]: 'ابزار' });
  const store = createMemoryWorkshopStore({ [FOOD]: 'خوراکی', [TOOLS]: 'ابزار' }, { author: 'سارا', r1: 'علی', r2: 'نگار', r3: 'پویا', r4: 'مینا' });
  const paid: { userId: string; key: string; coins: number }[] = [];
  const told: { userId: string; title: string }[] = [];
  const games: Record<string, number> = { r1: 10, r2: 10, r3: 10, r4: 10, author: 10, rookie: 1 };
  const svc = new WorkshopService({
    store,
    trivia,
    rules: async () => ({ ...RULES, ...rules }),
    games: async (id) => games[id] ?? 0,
    reward: async (userId, key, coins) => void paid.push({ userId, key, coins }),
    notify: async (userId, title) => void told.push({ userId, title }),
    now: () => store.clock.ms,
  });
  /** The index a reviewer sees the author's right answer at. */
  const shownRight = (reviewer: string, id: string, correct = 1) => blindOrder(reviewer, id).indexOf(correct);
  const shownWrong = (reviewer: string, id: string, correct = 1) => (shownRight(reviewer, id, correct) + 1) % 4;
  return { svc, store, trivia, paid, told, shownRight, shownWrong };
}

describe('submitting', () => {
  it('stores a question, limits the day, refuses unknown topics and near-duplicates (of the bank and of open ones)', async () => {
    const { svc, trivia } = await setup();
    await trivia.create({ topicId: FOOD, textFa: 'پایتخت ایران کدام شهر است؟', options: ['تهران', 'شیراز', 'اصفهان', 'تبریز'], correctIndex: 0, explanationFa: '', ageTrack: 'adult', difficulty: 1 }, 'approved');
    expect(await svc.submit('author', q(1, { topicId: '00000000-0000-7000-d000-0000000000ff' }))).toEqual({ ok: false, error: 'unknown_topic' });
    expect(await svc.submit('author', q(1, { textFa: 'پایتخت ایران کدام شهر است' }))).toEqual({ ok: false, error: 'duplicate' });
    expect(await svc.submit('author', q(1))).toMatchObject({ ok: true });
    expect(await svc.submit('r1', q(1))).toEqual({ ok: false, error: 'duplicate' }); // same text, open submission of someone else
    expect(await svc.submit('author', q(2))).toMatchObject({ ok: true });
    expect(await svc.submit('author', q(3))).toEqual({ ok: false, error: 'limit' });
    expect((await svc.info('author')).submitsLeftToday).toBe(0);
  });

  it('is closed when the switch is off', async () => {
    const { svc } = await setup({ on: false });
    expect(await svc.submit('author', q(1))).toEqual({ ok: false, error: 'off' });
  });
});

describe('reviewing', () => {
  it('gates by finished games, hides the answer, never offers your own or one you reviewed', async () => {
    const { svc } = await setup();
    const sub = await svc.submit('author', q(1));
    if (!sub.ok) throw new Error('submit');
    expect(await svc.feed('rookie')).toEqual({ locked: true, need: 5 });
    expect(await svc.review('rookie', sub.id, { answerIndex: 0, quality: 1 })).toEqual({ ok: false, error: 'locked' });
    expect(await svc.feed('author')).toMatchObject({ locked: false, card: null }); // nothing of others
    expect(await svc.review('author', sub.id, { answerIndex: 0, quality: 1 })).toEqual({ ok: false, error: 'own' });
    const feed = await svc.feed('r1');
    if (feed.locked || !feed.card) throw new Error('no card');
    expect(Object.keys(feed.card).sort()).toEqual(['difficulty', 'id', 'options', 'textFa', 'topicNameFa']);
    expect([...feed.card.options].sort()).toEqual(['الف1', 'ب1', 'ج1', 'د1']);
    await svc.review('r1', sub.id, { answerIndex: 0, quality: 1 });
    expect(await svc.review('r1', sub.id, { answerIndex: 0, quality: 1 })).toEqual({ ok: false, error: 'reviewed' });
    expect(await svc.feed('r1')).toMatchObject({ card: null });
    expect((await svc.info('r2')).waiting).toBe(1);
    expect((await svc.info('r1')).waiting).toBe(0);
  });

  it('three agreeing 👍 reviews send it to the admin queue; a doubted answer and bad ratings reject it', async () => {
    const { svc, store, shownRight, shownWrong } = await setup();
    const good = await svc.submit('author', q(1));
    const bad = await svc.submit('author', q(2));
    if (!good.ok || !bad.ok) throw new Error('submit');
    for (const [i, r] of ['r1', 'r2', 'r3'].entries()) {
      const out = await svc.review(r, good.id, { answerIndex: shownRight(r, good.id), quality: 1 });
      expect(out).toMatchObject({ ok: true, status: i === 2 ? 'ready_for_review' : 'pending' });
    }
    expect((await store.get(good.id))?.score).toBe(6);
    // r1 reviewed `good`; `bad` gets three disagreeing 👎 reviews (−2 each) → rejected at −6 ≤ −5
    const outs = [];
    for (const r of ['r1', 'r2', 'r3']) outs.push(await svc.review(r, bad.id, { answerIndex: shownWrong(r, bad.id), quality: -1 }));
    expect(outs.at(-1)).toMatchObject({ ok: true, status: 'rejected' });
    const row = await store.get(bad.id);
    expect(row).toMatchObject({ status: 'rejected', rejectReason: 'wrong_answer', disputes: 3 });
  });

  it('counts reviews per day and stops at the cap', async () => {
    const { svc } = await setup({ reviewDaily: 1 });
    const a = await svc.submit('author', q(1));
    const b = await svc.submit('author', q(2));
    if (!a.ok || !b.ok) throw new Error('submit');
    expect(await svc.review('r1', a.id, { answerIndex: 0, quality: 1 })).toMatchObject({ ok: true });
    expect(await svc.review('r1', b.id, { answerIndex: 0, quality: 1 })).toEqual({ ok: false, error: 'daily_limit' });
    expect(await svc.feed('r1')).toEqual({ locked: false, capped: true, card: null });
  });
});

describe('admin decision', () => {
  async function ready() {
    const env = await setup();
    const sub = await env.svc.submit('author', q(1));
    if (!sub.ok) throw new Error('submit');
    // r1 and r2 agree (pick the right one, 👍), r3 picks wrong and 👎, r4 picks right but 👎
    await env.svc.review('r1', sub.id, { answerIndex: env.shownRight('r1', sub.id), quality: 1 });
    await env.svc.review('r2', sub.id, { answerIndex: env.shownRight('r2', sub.id), quality: 1 });
    await env.svc.review('r3', sub.id, { answerIndex: env.shownWrong('r3', sub.id), quality: -1 });
    await env.svc.review('r4', sub.id, { answerIndex: env.shownRight('r4', sub.id), quality: -1 });
    return { ...env, id: sub.id };
  }

  it('approving makes the question play under the author, pays the reward once (first + thin bonus) and settles the reviewers', async () => {
    const { svc, store, trivia, paid, told, id } = await ready();
    const out = await svc.approve(id);
    expect(out).toMatchObject({ ok: true, reward: { base: 40, first: 40, thin: 15, total: 95 } });
    const bank = await trivia.list({ status: 'approved', limit: 10 });
    expect(bank).toHaveLength(1);
    expect(bank[0]).toMatchObject({ authorId: 'author', topicId: FOOD, correctIndex: 1, ageTrack: 'adult' });
    expect(paid.filter((p) => p.key === `trivia_author:${id}`)).toEqual([{ userId: 'author', key: `trivia_author:${id}`, coins: 95 }]);
    expect(told).toEqual([{ userId: 'author', title: 'سؤالت تأیید شد 🎉' }]);
    expect(await svc.approve(id)).toEqual({ ok: false, error: 'closed' });
    expect(paid.filter((p) => p.key.startsWith('trivia_author'))).toHaveLength(1);
    // r1, r2 agreed with the outcome: 1 + 3 points; r3 (wrong pick) and r4 (👎) keep the base point
    expect(await store.points('r1')).toBe(4);
    expect(await store.points('r2')).toBe(4);
    expect(await store.points('r3')).toBe(1);
    expect(await store.points('r4')).toBe(1);
    expect((await svc.mine('author'))[0]).toMatchObject({ status: 'approved', rewardCoins: 95 });
  });

  it('pays a coin milestone to a reviewer who crosses it, once', async () => {
    const { svc, paid, id } = await ready();
    await svc.approve(id);
    // milestone every 5 points here: r1 and r2 went 1 → 4 (no milestone yet)
    expect(paid.filter((p) => p.key.startsWith('trivia_review'))).toHaveLength(0);
    const more = await svc.submit('author', q(2));
    if (!more.ok) throw new Error('submit');
    await svc.review('r1', more.id, { answerIndex: 0, quality: 1 }); // 4 → 5 points
    expect(paid.filter((p) => p.key === 'trivia_review:r1:1')).toEqual([{ userId: 'r1', key: 'trivia_review:r1:1', coins: 10 }]);
  });

  it('an edited approval publishes the admin\'s version, and a rejection tells the author why and settles with 👎 agreement', async () => {
    const env = await ready();
    const edited = q(1, { textFa: 'نسخه‌ی ویرایش‌شده‌ی سؤال شماره ۱؟', correctIndex: 2 });
    expect(await env.svc.approve(env.id, edited)).toMatchObject({ ok: true });
    expect((await env.trivia.list({ status: 'approved', limit: 5 }))[0]).toMatchObject({ textFa: edited.textFa, correctIndex: 2 });

    const env2 = await ready();
    expect(await env2.svc.reject(env2.id, 'unclear')).toEqual({ ok: true });
    expect(await env2.svc.reject(env2.id, 'unclear')).toEqual({ ok: false, error: 'closed' });
    expect(env2.told.at(-1)?.title).toBe('سؤالت این بار تأیید نشد');
    expect(await env2.store.points('r4')).toBe(4); // picked the author's answer and gave 👎: that agrees with a rejection → 1 + 3
  });

  it('shows the queue, the top lists and the player\'s standing', async () => {
    const { svc, id } = await ready();
    expect((await svc.list('pending'))[0]).toMatchObject({ id, reviews: 4, disputes: 1, userName: 'سارا' });
    await svc.approve(id);
    const top = await svc.top('r1', 'all');
    expect(top.authors).toEqual([{ nickname: 'سارا', approved: 1, you: false }]);
    expect(top.reviewers[0]).toMatchObject({ points: 4, you: expect.any(Boolean) });
    const info = await svc.info('r1');
    expect(info).toMatchObject({ points: 4, title: 0, nextTitleAt: 30, approved: 0 });
  });
});
