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
  const scores: { chatId: string; weekKey: string; userRef: string; name: string; points: number; groups: number; wrong: number }[] = [];
  const store: GroupGameStore = {
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
  const svc = new GroupGameService({ store: mem.store, client, todayPuzzle: async () => puzzle, usernames: { bale: opts.bale === undefined ? 'dozari_bot' : opts.bale, telegram: 'dozari_tg' }, now: () => clock.t, newSeed: () => 7 });
  const msg = (text: string, chatId: number | string = -100, extra: Partial<NonNullable<BaleUpdate['message']>['chat']> = {}): BaleUpdate => ({ update_id: 1, message: { message_id: 1, chat: { id: chatId, type: 'group', title: 'دوستان', ...extra }, from: { id: 5 }, text } });
  const tap = (data: string, messageId: number, from = 5, chatId: number | string = -100): BaleUpdate => ({ update_id: 2, callback_query: { id: 'cb', from: { id: from, first_name: 'سارا' }, message: { message_id: messageId, chat: { id: chatId, type: 'group' } }, data } });
  return { svc, sent, edits, answers, mem, clock, msg, tap, client };
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
    expect(fin.keyboard[0]![0]!.url).toBe('https://ble.ir/dozari_bot?startapp=daily');
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
