import { describe, expect, it, vi } from 'vitest';
import { createTelegramClient } from '../notify/client.js';
import type { BaleClient, BaleUpdate, InlineKeyboard } from '../notify/client.js';
import { GroupGameService } from '../groupgame/service.js';
import type { GroupGameStore, GroupPlayResult } from '../groupgame/store.js';
import { parseCallback } from '../groupgame/render.js';
import type { ServedPuzzle } from '../solo/types.js';

const ids = (g: number) => [0, 1, 2, 3].map((i) => `p${g}${i}`);
const puzzle: ServedPuzzle = {
  id: 'pz1',
  groups: [0, 1, 2, 3].map((g) => ({ level: g as 0 | 1 | 2 | 3, productIds: ids(g), titleFa: `دسته ${g}`, explanationFa: '' })),
  items: Object.fromEntries([0, 1, 2, 3].flatMap((g) => ids(g).map((id) => [id, { nameFa: `کالا ${id}`, unitFa: null }]))),
};

function memoryStore() {
  const groups = new Map<string, { title: string; removed: boolean }>();
  const plays = new Map<string, { result: GroupPlayResult; mistakes?: number; players?: number }>();
  const priceSessions = new Map<string, number>();
  const questionSessions = new Map<string, number>();
  const scores: { chatId: string; weekKey: string; userRef: string; name: string; points: number; groups: number; wrong: number }[] = [];
  const store: GroupGameStore = {
    async refOf(chatId) { return groups.has(chatId) ? 'k3f9x2m' : null; },
    async startPriceSession(chatId, dateKey, max) {
      const k = `${chatId}|${dateKey}`;
      const n = priceSessions.get(k) ?? 0;
      if (n >= max) return false;
      priceSessions.set(k, n + 1);
      return true;
    },
    async startQuestionSession(chatId, dateKey, max) {
      const k = `${chatId}|${dateKey}`;
      const n = questionSessions.get(k) ?? 0;
      if (n >= max) return false;
      questionSessions.set(k, n + 1);
      return true;
    },
    async addScore(chatId, weekKey, d) {
      const row = scores.find((x) => x.chatId === chatId && x.weekKey === weekKey && x.userRef === d.userRef);
      if (row) { row.name = d.name; row.points += d.points; row.groups += d.groups; row.wrong += d.wrong; } else scores.push({ chatId, weekKey, ...d });
    },
    async weekScores(chatId, weekKey) { return scores.filter((x) => x.chatId === chatId && x.weekKey === weekKey); },
    async upsertGroup(g) { groups.set(g.chatId, { title: g.title, removed: false }); },
    async markRemoved(c) { const g = groups.get(c); if (g) g.removed = true; },
    async play(c, d) { const p = plays.get(`${c}|${d}`); return p ? { result: p.result } : null; },
    async startPlay(c, d) { if (plays.has(`${c}|${d}`)) return false; plays.set(`${c}|${d}`, { result: 'playing' }); return true; },
    async finishPlay(c, d, f) { const p = plays.get(`${c}|${d}`); if (!p || p.result !== 'playing') return false; plays.set(`${c}|${d}`, { result: f.result, mistakes: f.mistakes, players: f.players }); return true; },
  };
  return { store, groups, plays, scores };
}

function setup(opts: { bale?: string | null } = {}) {
  const sent: { chatId: string; text: string; keyboard?: InlineKeyboard }[] = [];
  const edits: { messageId: number; text: string; keyboard: InlineKeyboard }[] = [];
  const answers: (string | undefined)[] = [];
  let nextId = 100;
  const client: BaleClient = {
    sendMessage: vi.fn(async (chatId, text) => void sent.push({ chatId, text })),
    getUpdates: async () => [],
    sendInline: vi.fn(async (chatId, text, keyboard) => (sent.push({ chatId, text, keyboard }), { messageId: nextId++ })),
    editInline: vi.fn(async (_c, messageId, text, keyboard) => void edits.push({ messageId, text, keyboard })),
    answerCallback: vi.fn(async (_c, _id, text) => void answers.push(text)),
  };
  const mem = memoryStore();
  const clock = { t: Date.parse('2026-10-17T10:00:00Z') };
  const timers: { fn: () => void; ms: number }[] = [];
  const svc = new GroupGameService({
    store: mem.store,
    client,
    todayPuzzle: async () => puzzle,
    drawPrices: async (n) => [1, 2, 3, 4, 5].slice(0, n).map((i) => ({ nameFa: `نان ${i}`, unitFa: i === 1 ? 'عدد' : null, year: 1370 + i, actualRials: BigInt(i * 1000), options: [BigInt(i * 500), BigInt(i * 1000), BigInt(i * 2000), BigInt(i * 3000)] })),
    drawQuestions: async (n) => [1, 2, 3, 4, 5].slice(0, n).map((i) => ({ textFa: `پایتخت کشور ${i}؟`, options: ['الف', 'ب', 'ج', 'د'], correctIndex: 1, explanationFa: i === 1 ? 'چون این‌طور است' : '' })),
    schedule: (fn, ms) => void timers.push({ fn, ms }),
    tableCard: (code) => (code === 'AB2CD' ? { code, name: 'میز علی', format: '1v1', entryFee: 0, seats: 2, taken: 1, hostNickname: 'علی' } : code === 'FEE22' ? { code, name: 'میز پولی', format: '2v2', entryFee: 20, seats: 4, taken: 3, hostNickname: 'سارا' } : null), usernames: { bale: opts.bale === undefined ? 'dozari_bot' : opts.bale, telegram: 'dozari_tg' },
    now: () => clock.t,
    newSeed: () => 7,
  });
  const msg = (text: string, chatId: number | string = -100, extra: Partial<NonNullable<BaleUpdate['message']>['chat']> = {}): BaleUpdate => ({ update_id: 1, message: { message_id: 1, chat: { id: chatId, type: 'group', title: 'دوستان', ...extra }, from: { id: 5 }, text } });
  const tap = (data: string, messageId: number, from = 5, chatId: number | string = -100): BaleUpdate => ({ update_id: 2, callback_query: { id: 'cb', from: { id: from, first_name: 'سارا' }, message: { message_id: messageId, chat: { id: chatId, type: 'group' } }, data } });
  return { svc, sent, edits, answers, mem, clock, msg, tap, client, timers };
}

/** Button callback data for the card showing this product on the group's board. */
function cardData(kb: InlineKeyboard, productName: string): string {
  const b = kb.flat().find((x) => x.text === `کالا ${productName}`);
  return b!.callback_data!;
}
/** The one shared board message: it never changes between taps. */
const board = (t: ReturnType<typeof setup>) => t.sent.find((x) => x.keyboard?.length === 5)!.keyboard!;
const act = (kb: InlineKeyboard, name: 's' | 'c' | 'h') => kb.flat().find((b) => b.callback_data?.endsWith(`:${name}`))!.callback_data!;

async function pick(t: ReturnType<typeof setup>, productIds: string[], from = 5, mid = 100) {
  for (const id of productIds) await t.svc.handleUpdate(t.tap(cardData(board(t), id), mid, from));
}
const submit = (t: ReturnType<typeof setup>, from = 5, mid = 100) => t.svc.handleUpdate(t.tap(act(board(t), 's'), mid, from));
/** The close-of-round timer (the last one scheduled when the board was posted). */
const closeRound = async (t: ReturnType<typeof setup>) => {
  t.timers.find((x) => x.ms === 15 * 60 * 1000)!.fn();
  await new Promise((r) => setTimeout(r, 0));
};

describe('group game', () => {
  it('ignores private chats and non-group callbacks', async () => {
    const t = setup();
    expect(await t.svc.handleUpdate({ update_id: 1, message: { message_id: 1, chat: { id: 5 }, text: '/play' } })).toBe(false);
    expect(await t.svc.handleUpdate({ update_id: 1, callback_query: { id: 'x', from: { id: 1 }, data: 'other' } })).toBe(false);
  });

  it('registers on the first command, welcomes on /start and swallows other chatter', async () => {
    const t = setup();
    expect(await t.svc.handleUpdate(t.msg('/start@dozari_bot'))).toBe(true);
    expect(t.mem.groups.get('-100')?.title).toBe('دوستان');
    expect(t.sent[0]!.text).toContain('/play');
    expect(await t.svc.handleUpdate(t.msg('ABCD23'))).toBe(true); // a link code typed in a group must not reach the private flow
    expect(t.sent).toHaveLength(1);
  });

  it('stays silent on chatter, answers once a minute when called by name, and spots a group without a chat type', async () => {
    const t = setup();
    expect(await t.svc.handleUpdate(t.msg('سلام'))).toBe(true);
    expect(t.sent).toHaveLength(0);
    await t.svc.handleUpdate(t.msg('دوزاری چطوری بازی میشه؟'));
    expect(t.sent).toHaveLength(1);
    await t.svc.handleUpdate(t.msg('@dozari_bot'));
    expect(t.sent).toHaveLength(1); // rate limited
    // a host that omits `type`: the chat id differs from the sender's id, so it is a group, not the private link flow
    const typeless: BaleUpdate = { update_id: 1, message: { message_id: 1, chat: { id: -300 }, from: { id: 5 }, text: 'به به سلام' } };
    expect(await t.svc.handleUpdate(typeless)).toBe(true);
    expect(t.sent).toHaveLength(1);
  });

  it('handles the bot being added and removed', async () => {
    const t = setup();
    await t.svc.handleUpdate({ update_id: 1, my_chat_member: { chat: { id: -9, type: 'supergroup', title: 'G' }, new_chat_member: { status: 'member' } } });
    expect(t.mem.groups.get('-9')?.removed).toBe(false);
    expect(t.sent).toHaveLength(1);
    await t.svc.handleUpdate({ update_id: 1, my_chat_member: { chat: { id: -9, type: 'supergroup' }, new_chat_member: { status: 'kicked' } } });
    expect(t.mem.groups.get('-9')?.removed).toBe(true);
  });

  it('/play posts a 4x4 board plus action row and never leaks the solution', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/play'));
    const b = t.sent[0]!;
    expect(b.keyboard).toHaveLength(5);
    expect(b.keyboard!.slice(0, 4).every((r) => r.length === 4)).toBe(true);
    expect(b.keyboard!.at(-1)).toHaveLength(2); // submit + clear, no shuffle on a shared board
    expect(b.text).not.toContain('دسته 0'); // titles only after the round closes
    expect(b.text).toContain('۱۵ دقیقه');
    expect(t.mem.plays.get('-100|2026-10-17')?.result).toBe('playing');
  });

  it('answers each member alone: picks, refusals and results are toasts, the group message is never edited', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/play'));
    await pick(t, ids(0).slice(0, 2));
    expect(t.answers.at(-1)).toContain('۲ از ۴');
    expect(t.answers.at(-1)).toContain('کالا p01');
    await submit(t);
    expect(t.answers.at(-1)).toContain('۴');
    await pick(t, [...ids(0).slice(2), ids(1)[0]!]);
    expect(t.answers.at(-1)).toBe('حداکثر ۴ کارت');
    await pick(t, [ids(0)[0]!]); // untick
    expect(t.answers.at(-1)).toContain('برداشته شد');
    await t.svc.handleUpdate(t.tap(act(board(t), 'c'), 100));
    expect(t.answers.at(-1)).toContain('پاک شد');
    expect(t.edits).toHaveLength(0);
  });

  it('keeps every member\'s selection and mistakes separate', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/play'));
    await pick(t, ids(0).slice(0, 3), 5);
    await pick(t, ids(1).slice(0, 2), 6);
    expect(t.answers.at(-1)).toContain('۲ از ۴'); // user 6 starts from zero
    await pick(t, [ids(0)[3]!], 5);
    await submit(t, 5);
    expect(t.answers.at(-1)).toContain('دسته 0');
    await submit(t, 6); // only two cards ticked
    expect(t.answers.at(-1)).toBe('باید دقیقاً ۴ کارت انتخاب کنید');
    expect(t.edits).toHaveLength(0);
  });

  it('tells the submitter alone: one away, wrong with chances left, a duplicate, a card already solved', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/play'));
    await pick(t, [ids(1)[0]!, ids(1)[1]!, ids(1)[2]!, ids(2)[0]!]);
    await submit(t);
    expect(t.answers.at(-1)).toContain('فقط یک کارت');
    expect(t.answers.at(-1)).toContain('۳ فرصت');
    await pick(t, [ids(1)[0]!, ids(1)[1]!, ids(1)[2]!, ids(2)[0]!]);
    await submit(t);
    expect(t.answers.at(-1)).toContain('قبلاً امتحان');
    await pick(t, [ids(0)[0]!, ids(1)[0]!, ids(2)[0]!, ids(3)[0]!]);
    await submit(t);
    expect(t.answers.at(-1)).toContain('اشتباه بود');
    await pick(t, ids(0));
    await submit(t);
    await pick(t, [ids(0)[0]!]);
    expect(t.answers.at(-1)).toContain('جزو دسته‌ای');
  });

  it('closes after 15 minutes: reveals the answers, ranks everyone, records one result and offers the app link', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/play'));
    for (const g of [0, 1, 2]) {
      await pick(t, ids(g), 5); // user 5 finds everything
      await submit(t, 5);
    }
    expect(t.answers.at(-1)).toContain('هر ۴ دسته');
    await pick(t, ids(3), 6); // user 6: one group, one mistake
    await submit(t, 6);
    await pick(t, [ids(0)[0]!, ids(1)[0]!, ids(2)[0]!, ids(3)[0]!], 7);
    await submit(t, 7); // user 7: only a mistake
    await new Promise((r) => setTimeout(r, 0));
    expect(t.edits).toHaveLength(0); // nothing leaked while the round runs
    await closeRound(t);
    expect(t.edits.at(-1)!.text).toContain('وقت تمام شد');
    expect(t.edits.at(-1)!.keyboard).toEqual([]);
    const res = t.sent.at(-1)!;
    for (let g = 0; g < 4; g++) expect(res.text).toContain(`دسته ${g}`);
    expect(res.text).toContain('🥇 سارا — ۴ دسته از ۴ · ۰ اشتباه');
    expect(res.text.indexOf('۴ دسته از ۴')).toBeLessThan(res.text.indexOf('۱ دسته از ۴'));
    expect(res.text).toContain('🥉 سارا — ۰ دسته از ۴ · ۱ اشتباه');
    expect(res.keyboard![0]![0]!.url).toBe('https://ble.ir/dozari_bot?startapp=daily_gk3f9x2m');
    expect(t.mem.plays.get('-100|2026-10-17')).toMatchObject({ result: 'won', players: 3 });
    const n = t.sent.length;
    await t.svc.handleUpdate(t.msg('/play'));
    expect(t.sent.length).toBe(n + 1);
    expect(t.sent.at(-1)!.text).toContain('پازل بعدی فردا');
    expect(t.sent.at(-1)!.keyboard![0]![0]!.url).toContain('startapp=daily');
  });

  it('a member who runs out of chances is told and waits; a tap after the deadline closes the round', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/play'));
    for (let i = 0; i < 4; i++) {
      await pick(t, [ids(0)[0]!, ids(1)[0]!, ids(2)[0]!, ids(3)[i]!]);
      await submit(t);
    }
    expect(t.answers.at(-1)).toContain('فرصت‌هایت تمام شد');
    await t.svc.handleUpdate(t.tap(cardData(board(t), ids(0)[0]!), 100));
    expect(t.answers.at(-1)).toContain('بازی تو تمام شده');
    expect(t.mem.plays.get('-100|2026-10-17')?.result).toBe('playing'); // the group's round still runs for the others
    t.clock.t += 16 * 60 * 1000;
    await t.svc.handleUpdate(t.tap(cardData(board(t), ids(0)[0]!), 100, 8));
    expect(t.answers.at(-1)).toContain('وقت بازی تمام شد');
    expect(t.mem.plays.get('-100|2026-10-17')?.result).toBe('lost');
    await closeRound(t); // the timer firing later does nothing twice
    expect(t.sent.filter((x) => x.text.includes('نتیجه‌ی پازل')).length).toBe(1);
  });

  it('nobody played: says so; a reminder with the number of players goes out five minutes before', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/play'));
    await pick(t, [ids(0)[0]!]);
    t.timers.find((x) => x.ms === 10 * 60 * 1000)!.fn();
    await new Promise((r) => setTimeout(r, 0));
    expect(t.sent.at(-1)!.text).toContain('۵ دقیقه');
    expect(t.sent.at(-1)!.text).toContain('۱ نفر');
    await closeRound(t);
    expect(t.sent.at(-1)!.text).toContain('۰ دسته از ۴'); // opened the board but never submitted: still listed
    const q = setup();
    await q.svc.handleUpdate(q.msg('/play'));
    await closeRound(q);
    expect(q.sent.at(-1)!.text).toContain('کسی بازی نکرد');
  });

  it('a second /play while the board is live moves the board and retires the old message', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/play'));
    await t.svc.handleUpdate(t.msg('/play'));
    expect(t.sent).toHaveLength(2);
    await t.svc.handleUpdate(t.tap(cardData(t.sent[0]!.keyboard!, ids(0)[0]!), 100));
    expect(t.answers.at(-1)).toContain('تمام شده');
    await t.svc.handleUpdate(t.tap(cardData(t.sent[1]!.keyboard!, ids(0)[0]!), 101));
    expect(t.answers.at(-1)).toContain('۱ از ۴');
  });

  it('a play left running by a restart can be restarted; no username means a plain results message', async () => {
    const t = setup({ bale: null });
    t.mem.plays.set('-100|2026-10-17', { result: 'playing' });
    await t.svc.handleUpdate(t.msg('/play'));
    expect(t.sent[0]!.keyboard).toHaveLength(5);
    await closeRound(t);
    expect(t.sent.at(-1)!.keyboard).toBeUndefined();
  });

  it('/top ranks this week\'s members and starts empty', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/top'));
    expect(t.sent.at(-1)!.text).toContain('هنوز کسی');
    await t.svc.handleUpdate(t.msg('/play'));
    await pick(t, ids(0), 5); // yellow, by user 5
    await submit(t, 5);
    await pick(t, ids(3), 6); // purple, by user 6
    await submit(t, 6);
    await pick(t, [ids(1)[0]!, ids(1)[1]!, ids(1)[2]!, ids(2)[0]!], 5);
    await submit(t, 5); // wrong, user 5
    await new Promise((r) => setTimeout(r, 0));
    await t.svc.handleUpdate(t.msg('/top@dozari_bot'));
    const text = t.sent.at(-1)!.text;
    expect(text).toContain('🥇 سارا — ۲۵ امتیاز (۱ دسته)');
    expect(text.indexOf('۲۵ امتیاز')).toBeLessThan(text.indexOf('۱۰ امتیاز'));
    expect(t.mem.scores.find((x) => x.userRef === '5')).toMatchObject({ points: 10, groups: 1, wrong: 1 });
  });

  it('answers an old shuffle button without changing anything; limits taps per person per minute', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/play'));
    await t.svc.handleUpdate(t.tap('g:1:h', 100));
    expect(t.answers.at(-1)).toContain('بُر زدن');
    const before = t.answers.length;
    for (let i = 0; i < 45; i++) await t.svc.handleUpdate(t.tap(act(board(t), 'c'), 100, 9));
    expect(t.answers.slice(before).filter((x) => x === 'انتخاب‌هایت پاک شد').length).toBeLessThanOrEqual(40);
  });
});

describe('price mode', () => {
  const run = async (t: ReturnType<typeof setup>) => {
    // the countdown ticks come first; the closing bell is the 40 s timer, the next question the 4 s one
    const i = t.timers.findIndex((x) => x.ms === 40_000 || x.ms === 4_000);
    const [timer] = t.timers.splice(i, 1);
    timer!.fn();
    await new Promise((r) => setTimeout(r, 0));
  };
  const priceTap = (t: ReturnType<typeof setup>, q: number, opt: number, mid: number, from: number, name = 'سارا') =>
    t.svc.handleUpdate({ update_id: 3, callback_query: { id: 'p', from: { id: from, first_name: name }, message: { message_id: mid, chat: { id: -100, type: 'group' } }, data: `p:${q}:${opt}` } });

  it('asks four-choice questions without leaking the answer, locks one answer per member and reveals on time-up', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/price'));
    const q = t.sent[0]!;
    expect(q.text).toContain('نان 1 (عدد)');
    expect(q.text).toContain('۱۳۷۱');
    expect(q.text).toContain('۴۰ ثانیه مانده');
    expect(q.text).toContain('هنوز کسی جواب نداده');
    expect(q.keyboard).toHaveLength(4);
    expect(q.keyboard!.flat().every((b) => /^p:0:[0-3]$/.test(b.callback_data!))).toBe(true);
    await priceTap(t, 0, 1, 100, 5); // the right option
    expect(t.answers.at(-1)).toContain('ثبت شد');
    await priceTap(t, 0, 3, 100, 5); // second try is refused
    expect(t.answers.at(-1)).toContain('قبلاً');
    await priceTap(t, 0, 0, 100, 6, 'علی');
    await run(t);
    const reveal = t.edits.at(-1)!;
    expect(reveal.text).toContain('✅ سارا (+۵)');
    expect(reveal.text).toContain('❌ علی');
    expect(reveal.keyboard).toEqual([]);
    await priceTap(t, 0, 1, 100, 7); // too late
    expect(t.answers.at(-1)).toContain('تمام');
    expect(t.mem.scores.find((x) => x.userRef === '5')).toMatchObject({ points: 5, wrong: 0 });
    expect(t.mem.scores.find((x) => x.userRef === '6')).toMatchObject({ points: 0, wrong: 1 });
  });

  it('counts down on the question itself: seconds left and how many answered, buttons kept, no answers leaked', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/price'));
    await priceTap(t, 0, 1, 100, 5);
    const ticks = t.timers.filter((x) => x.ms < 40_000 && x.ms >= 10_000).sort((a, b) => a.ms - b.ms);
    expect(ticks.map((x) => x.ms)).toEqual([10_000, 20_000, 30_000]);
    ticks[0]!.fn();
    await new Promise((r) => setTimeout(r, 0));
    const e = t.edits.at(-1)!;
    expect(e.text).toContain('۳۰ ثانیه مانده');
    expect(e.text).toContain('۱ نفر جواب داده‌اند');
    expect(e.keyboard).toHaveLength(4);
    ticks[2]!.fn();
    await new Promise((r) => setTimeout(r, 0));
    expect(t.edits.at(-1)!.text).toContain('۱۰ ثانیه مانده');
    await run(t);
    ticks[1]!.fn(); // a late tick after the reveal does nothing
    await new Promise((r) => setTimeout(r, 0));
    expect(t.edits.at(-1)!.text).toContain('قیمت درست');
  });

  const playOut = async (t: ReturnType<typeof setup>, firstMessageId: number) => {
    for (let i = 0; i < 5; i++) {
      await priceTap(t, i, 1, firstMessageId + i, 5);
      await run(t); // time up
      if (i < 4) await run(t); // pause is over, next question
    }
  };

  it('runs all rounds, ends with a summary and the app link, and caps sessions per day', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/price'));
    await playOut(t, 100);
    const last = t.sent.at(-1)!;
    expect(last.text).toContain('🥇 سارا — ۲۵ امتیاز');
    expect(last.keyboard![0]![0]!.url).toContain('startapp=daily');
    await t.svc.handleUpdate(t.msg('/price')); // the second session of the day
    await playOut(t, 106); // ids 100-104 questions, 105 the summary
    await t.svc.handleUpdate(t.msg('/price')); // the third is refused
    expect(t.sent.at(-1)!.text).toContain('امروز ۲ دور');
  });

  it('refuses a second session while one is running and stale taps', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/price'));
    await t.svc.handleUpdate(t.msg('/price'));
    expect(t.sent.at(-1)!.text).toContain('در جریان');
    await priceTap(t, 3, 1, 100, 5); // wrong question index
    expect(t.answers.at(-1)).toContain('تمام');
  });
});

describe('question mode', () => {
  const run = async (t: ReturnType<typeof setup>) => {
    const i = t.timers.findIndex((x) => x.ms === 40_000 || x.ms === 4_000);
    const [timer] = t.timers.splice(i, 1);
    timer!.fn();
    await new Promise((r) => setTimeout(r, 0));
  };
  const qTap = (t: ReturnType<typeof setup>, q: number, opt: number, mid: number, from: number, name = 'سارا') =>
    t.svc.handleUpdate({ update_id: 3, callback_query: { id: 'q', from: { id: from, first_name: name }, message: { message_id: mid, chat: { id: -100, type: 'group' } }, data: `q:${q}:${opt}` } });

  it('asks a general question without leaking the answer, locks one answer per member and reveals with the explanation', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/question'));
    const q = t.sent[0]!;
    expect(q.text).toContain('پایتخت کشور 1؟');
    expect(q.text).toContain('هنوز کسی جواب نداده');
    expect(q.keyboard!.flat().map((b) => b.text)).toEqual(['الف', 'ب', 'ج', 'د']);
    expect(q.keyboard!.flat().every((b) => /^q:0:[0-3]$/.test(b.callback_data!))).toBe(true);
    await qTap(t, 0, 1, 100, 5);
    expect(t.answers.at(-1)).toContain('ثبت شد');
    await qTap(t, 0, 3, 100, 5);
    expect(t.answers.at(-1)).toContain('قبلاً');
    await qTap(t, 0, 0, 100, 6, 'علی');
    await run(t);
    const reveal = t.edits.at(-1)!;
    expect(reveal.text).toContain('جواب درست: ب');
    expect(reveal.text).toContain('چون این‌طور است');
    expect(reveal.text).toContain('✅ سارا (+۵)');
    expect(reveal.text).toContain('❌ علی');
    await qTap(t, 0, 1, 100, 7); // too late
    expect(t.answers.at(-1)).toContain('تمام');
    expect(t.mem.scores.find((x) => x.userRef === '5')).toMatchObject({ points: 5, wrong: 0 });
    expect(t.mem.scores.find((x) => x.userRef === '6')).toMatchObject({ points: 0, wrong: 1 });
  });

  it('runs all rounds into the same weekly tally as the puzzle, then caps sessions per day', async () => {
    const t = setup();
    const playOut = async (firstId: number) => {
      for (let i = 0; i < 5; i++) {
        await qTap(t, i, 1, firstId + i, 5);
        await run(t);
        if (i < 4) await run(t);
      }
    };
    await t.svc.handleUpdate(t.msg('/question'));
    await playOut(100);
    expect(t.sent.at(-1)!.text).toContain('🥇 سارا — ۲۵ امتیاز');
    await t.svc.handleUpdate(t.msg('/question'));
    await playOut(106);
    await t.svc.handleUpdate(t.msg('/question'));
    expect(t.sent.at(-1)!.text).toContain('امروز ۲ دور');
    expect(t.mem.scores.find((x) => x.userRef === '5')!.points).toBe(50);
  });

  it('refuses a second session while one is running', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/question'));
    await t.svc.handleUpdate(t.msg('/question'));
    expect(t.sent.at(-1)!.text).toContain('در جریان');
  });
});

describe('table card', () => {
  it('posts a card with a deep link to the table, naming the group that sent the player', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/table ab2cd'));
    const card = t.sent.at(-1)!;
    expect(card.text).toContain('میز «میز علی»');
    expect(card.text).toContain('رایگان');
    expect(card.keyboard![0]![0]!.url).toBe('https://ble.ir/dozari_bot?startapp=table_AB2CD_gk3f9x2m');
    await t.svc.handleUpdate(t.msg('/table FEE22'));
    expect(t.sent.at(-1)!.text).toContain('۲۰ سکه');
    expect(t.sent.at(-1)!.text).toContain('۲ به ۲');
  });

  it('explains a missing, malformed or unknown code, and slows a flood', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/table'));
    expect(t.sent.at(-1)!.text).toContain('/table AB2CD');
    await t.svc.handleUpdate(t.msg('/table AB1CD')); // 1 is not in the alphabet
    expect(t.sent.at(-1)!.text).toContain('/table AB2CD');
    await t.svc.handleUpdate(t.msg('/table ZZZZZ'));
    expect(t.sent.at(-1)!.text).toContain('پیدا نشد');
    await t.svc.handleUpdate(t.msg('/table AB2CD'));
    await t.svc.handleUpdate(t.msg('/table AB2CD'));
    await t.svc.handleUpdate(t.msg('/table AB2CD')); // the fourth card in a minute
    expect(t.sent.at(-1)!.text).toContain('کمی صبر');
  });

  it('gives no card without a bot username for the link', async () => {
    const t = setup({ bale: null });
    await t.svc.handleUpdate(t.msg('/table AB2CD'));
    expect(t.sent.at(-1)!.text).toContain('پیدا نشد');
  });
});

describe('callback data and clients', () => {
  it('parses our callback data only', () => {
    expect(parseCallback('g:12:t5')).toEqual({ rev: 12, action: { card: 5 } });
    expect(parseCallback('g:1:s')).toEqual({ rev: 1, action: 's' });
    expect(parseCallback('x:1:s')).toBeNull();
    expect(parseCallback('g:1:t99999')).toBeNull();
    expect(parseCallback(undefined)).toBeNull();
  });

  it('Telegram client maps callback and membership ids and strips the prefix on edits', async () => {
    const reply = (result: unknown) => vi.fn(async (_u: string, _i?: RequestInit) => new Response(JSON.stringify({ ok: true, result }), { status: 200 }));
    const fetchImpl = reply([
      { update_id: 1, callback_query: { id: 'c', from: { id: 3, first_name: 'A' }, message: { message_id: 9, chat: { id: -77, type: 'group' } }, data: 'g:1:s' } },
      { update_id: 2, my_chat_member: { chat: { id: -77, type: 'group', title: 'G' }, new_chat_member: { status: 'member' } } },
    ]);
    const tg = createTelegramClient('1:tok', { fetchImpl: fetchImpl as unknown as typeof fetch });
    const [a, b] = await tg.getUpdates(0, 1);
    expect(a!.callback_query!.from.id).toBe('tg:3');
    expect(a!.callback_query!.message!.chat.id).toBe('tg:-77');
    expect(b!.my_chat_member!.chat.id).toBe('tg:-77');
    await tg.editInline!('tg:-77', 9, 'x', [[{ text: 'a', callback_data: 'g:1:s' }]]);
    const body = JSON.parse((fetchImpl.mock.calls[1]![1] as RequestInit).body as string);
    expect(body).toMatchObject({ chat_id: '-77', message_id: 9, reply_markup: { inline_keyboard: [[{ text: 'a', callback_data: 'g:1:s' }]] } });
    expect(String(fetchImpl.mock.calls[1]![0])).toContain('/editMessageText');
  });
});
