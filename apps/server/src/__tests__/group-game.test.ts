import { describe, expect, it, vi } from 'vitest';
import { createTelegramClient } from '../notify/client.js';
import type { BaleClient, BaleUpdate, InlineKeyboard } from '../notify/client.js';
import { GroupGameService } from '../groupgame/service.js';
import type { GroupGameStore, GroupPlayResult } from '../groupgame/store.js';
import { parseCallback, renderBoard } from '../groupgame/render.js';
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
    schedule: (fn, ms) => void timers.push({ fn, ms }),
    tableCard: (code) => (code === 'AB2CD' ? { code, name: 'میز علی', format: '1v1', entryFee: 0, seats: 2, taken: 1, hostNickname: 'علی' } : code === 'FEE22' ? { code, name: 'میز پولی', format: '2v2', entryFee: 20, seats: 4, taken: 3, hostNickname: 'سارا' } : null), usernames: { bale: opts.bale === undefined ? 'dozari_bot' : opts.bale, telegram: 'dozari_tg' },
    now: () => clock.t,
    newSeed: () => 7,
  });
  const msg = (text: string, chatId: number | string = -100, extra: Partial<NonNullable<BaleUpdate['message']>['chat']> = {}): BaleUpdate => ({ update_id: 1, message: { message_id: 1, chat: { id: chatId, type: 'group', title: 'دوستان', ...extra }, from: { id: 5 }, text } });
  const tap = (data: string, messageId: number, from = 5, chatId: number | string = -100): BaleUpdate => ({ update_id: 2, callback_query: { id: 'cb', from: { id: from, first_name: 'سارا' }, message: { message_id: messageId, chat: { id: chatId, type: 'group' } }, data } });
  return { svc, sent, edits, answers, mem, clock, msg, tap, client, timers };
}

/** Button callback data for the card showing this product on the latest board. */
function cardData(kb: InlineKeyboard, productName: string): string {
  const b = kb.flat().find((x) => x.text.replace('✅ ', '') === `کالا ${productName}`);
  return b!.callback_data!;
}
const lastKeyboard = (t: ReturnType<typeof setup>) => (t.edits.length ? t.edits[t.edits.length - 1]!.keyboard : t.sent[t.sent.length - 1]!.keyboard!);
const act = (kb: InlineKeyboard, name: 's' | 'c' | 'h') => kb.flat().find((b) => b.callback_data?.endsWith(`:${name}`))!.callback_data!;

async function pick(t: ReturnType<typeof setup>, productIds: string[], mid = 100) {
  for (const id of productIds) await t.svc.handleUpdate(t.tap(cardData(lastKeyboard(t), id), mid));
}

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
    const board = t.sent[0]!;
    expect(board.keyboard).toHaveLength(5);
    expect(board.keyboard!.slice(0, 4).every((r) => r.length === 4)).toBe(true);
    expect(board.text).not.toContain('دسته 0'); // titles only after a group is found
    expect(t.mem.plays.get('-100|2026-10-17')?.result).toBe('playing');
  });

  it('toggles cards, refuses a fifth and a short submit', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/play'));
    await pick(t, ids(0).slice(0, 2));
    expect(lastKeyboard(t).flat().filter((b) => b.text.startsWith('✅'))).toHaveLength(2);
    await t.svc.handleUpdate(t.tap(act(lastKeyboard(t), 's'), 100));
    expect(t.answers.at(-1)).toContain('۴');
    await pick(t, [...ids(0).slice(2), ids(1)[0]!]);
    expect(t.answers.at(-1)).toBe('حداکثر ۴ کارت');
    await pick(t, [ids(0)[0]!]); // untick
    expect(lastKeyboard(t).flat().filter((b) => b.text.startsWith('✅'))).toHaveLength(3);
  });

  it('solves a group, reveals its title and counts mistakes', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/play'));
    await pick(t, ids(0));
    await t.svc.handleUpdate(t.tap(act(lastKeyboard(t), 's'), 100));
    const e = t.edits.at(-1)!;
    expect(e.text).toContain('دسته 0');
    expect(e.text).toContain('سارا');
    expect(e.keyboard.slice(0, -1).flat()).toHaveLength(12);
    await pick(t, [ids(1)[0]!, ids(1)[1]!, ids(1)[2]!, ids(2)[0]!]);
    await t.svc.handleUpdate(t.tap(act(lastKeyboard(t), 's'), 100));
    expect(t.edits.at(-1)!.text).toContain('فقط یک کارت');
    expect(t.edits.at(-1)!.text).toContain('🖤');
  });

  it('rejects a tap made on a stale board and redraws', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/play'));
    const stale = cardData(lastKeyboard(t), ids(0)[0]!);
    await pick(t, [ids(0)[1]!]); // rev moves on
    const before = t.edits.length;
    await t.svc.handleUpdate(t.tap(stale, 100));
    expect(t.answers.at(-1)).toBe('صفحه به‌روز شد');
    expect(t.edits.length).toBe(before + 1);
    expect(lastKeyboard(t).flat().filter((b) => b.text.startsWith('✅'))).toHaveLength(1);
  });

  it('wins, records one result, and offers the app link; a second /play only shows the result', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/play'));
    for (const g of [0, 1, 2]) {
      await pick(t, ids(g));
      await t.svc.handleUpdate(t.tap(act(lastKeyboard(t), 's'), 100));
    }
    const fin = t.edits.at(-1)!;
    expect(fin.text).toContain('آفرین');
    expect(fin.keyboard[0]![0]!.url).toBe('https://ble.ir/dozari_bot?startapp=daily_gk3f9x2m');
    expect(fin.keyboard).toHaveLength(1);
    expect(t.mem.plays.get('-100|2026-10-17')).toMatchObject({ result: 'won', mistakes: 0, players: 1 });
    const n = t.sent.length;
    await t.svc.handleUpdate(t.msg('/play'));
    expect(t.sent.length).toBe(n + 1);
    expect(t.sent.at(-1)!.text).toContain('پازل بعدی فردا');
    expect(t.sent.at(-1)!.keyboard![0]![0]!.url).toContain('startapp=daily');
  });

  it('loses after the mistakes run out and reveals the rest', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/play'));
    for (let i = 0; i < 4; i++) {
      await pick(t, [ids(0)[0]!, ids(1)[0]!, ids(2)[0]!, ids(3)[i]!]);
      await t.svc.handleUpdate(t.tap(act(lastKeyboard(t), 's'), 100));
    }
    expect(t.mem.plays.get('-100|2026-10-17')?.result).toBe('lost');
    expect(t.edits.at(-1)!.text).toContain('دسته 3');
    await t.svc.handleUpdate(t.tap('g:9:s', 100));
    expect(t.answers.at(-1)).toContain('تمام شده');
  });

  it('a second /play while the board is live moves the board and retires the old message', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/play'));
    await t.svc.handleUpdate(t.msg('/play'));
    expect(t.sent).toHaveLength(2);
    await t.svc.handleUpdate(t.tap(cardData(t.sent[0]!.keyboard!, ids(0)[0]!), 100));
    expect(t.answers.at(-1)).toContain('تمام شده');
    await t.svc.handleUpdate(t.tap(cardData(t.sent[1]!.keyboard!, ids(0)[0]!), 101));
    expect(t.edits).toHaveLength(1);
  });

  it('a play left running by a restart can be restarted; no username means no button', async () => {
    const t = setup({ bale: null });
    t.mem.plays.set('-100|2026-10-17', { result: 'playing' });
    await t.svc.handleUpdate(t.msg('/play'));
    expect(t.sent[0]!.keyboard).toHaveLength(5);
    const url = renderBoard({ puzzle, state: { remaining: [], solved: [], mistakes: 0, tried: [], status: 'won' }, selection: [], rev: 1, maxMistakes: 4, dateFa: '', note: '', players: 1, ctaUrl: null });
    expect(url.keyboard).toEqual([]);
  });

  it('/top ranks this week\'s members and starts empty', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/top'));
    expect(t.sent.at(-1)!.text).toContain('هنوز کسی');
    await t.svc.handleUpdate(t.msg('/play'));
    await pick(t, ids(0)); // yellow, by user 5
    await t.svc.handleUpdate(t.tap(act(lastKeyboard(t), 's'), 100, 5));
    await pick(t, ids(3)); // purple, by user 6
    await t.svc.handleUpdate(t.tap(act(lastKeyboard(t), 's'), 100, 6));
    await pick(t, [ids(1)[0]!, ids(1)[1]!, ids(1)[2]!, ids(2)[0]!]);
    await t.svc.handleUpdate(t.tap(act(lastKeyboard(t), 's'), 100, 5)); // wrong, user 5
    await new Promise((r) => setTimeout(r, 0));
    await t.svc.handleUpdate(t.msg('/top@dozari_bot'));
    const text = t.sent.at(-1)!.text;
    expect(text).toContain('🥇 سارا — ۲۵ امتیاز (۱ دسته)');
    expect(text.indexOf('۲۵ امتیاز')).toBeLessThan(text.indexOf('۱۰ امتیاز'));
    expect(t.mem.scores.find((x) => x.userRef === '5')).toMatchObject({ points: 10, groups: 1, wrong: 1 });
  });

  it('shuffles without changing the card set', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/play'));
    const names = (kb: InlineKeyboard) => kb.slice(0, 4).flat().map((b) => b.text).sort();
    const before = names(lastKeyboard(t));
    await t.svc.handleUpdate(t.tap(act(lastKeyboard(t), 'h'), 100));
    expect(names(lastKeyboard(t))).toEqual(before);
  });

  it('limits taps per person per minute', async () => {
    const t = setup();
    await t.svc.handleUpdate(t.msg('/play'));
    for (let i = 0; i < 45; i++) await t.svc.handleUpdate(t.tap(act(lastKeyboard(t), 'c'), 100, 9));
    expect(t.edits.length).toBeLessThanOrEqual(40);
  });
});

describe('price mode', () => {
  const run = async (t: ReturnType<typeof setup>) => {
    const timer = t.timers.shift()!;
    timer.fn();
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
