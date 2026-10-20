import { GROUP_PRICE_PAUSE_MS, GROUP_PRICE_POINTS, GROUP_PRICE_ROUNDS, GROUP_PRICE_ROUND_MS, GROUP_PRICE_SESSIONS_PER_DAY, GROUP_PRICE_TICK_MS, GROUP_TAP_LIMIT, GROUP_TOP_SIZE, dailyDateKey, groupWeekKey, rialsToTomanString } from '@dozari/shared';
import type { BaleClient, BaleUpdate, InlineKeyboard } from '../notify/client.js';
import { RateLimiter } from '../security/rate-limit.js';
import type { ScoreDelta } from './record.js';
import type { GroupGameStore } from './store.js';
import { GROUP_TEXT, PRICE_TEXT } from './texts.js';

/** One question of a price session. `actualRials` never leaves the server before the reveal. */
export interface GroupPriceQuestion {
  nameFa: string;
  unitFa: string | null;
  year: number;
  actualRials: bigint;
  /** The four choices, ascending. */
  options: readonly bigint[];
}

export interface GroupPriceDeps {
  store: GroupGameStore;
  client: BaleClient;
  /** Fresh questions over distinct products (fewer when the catalog is small). */
  draw: (count: number) => Promise<GroupPriceQuestion[]>;
  /** Saves a member's points (weekly tally and their account). */
  record: (chatId: string, weekKey: string, dateKey: string, d: ScoreDelta) => Promise<void>;
  ctaUrl: (chatId: string) => string | null;
  /** Runs `fn` after `ms` (a real timer in production). */
  schedule: (fn: () => void, ms: number) => void;
  now: () => number;
  log?: (msg: string, err?: unknown) => void;
}

interface Answer {
  name: string;
  choice: number;
}

interface Session {
  dateKey: string;
  questions: GroupPriceQuestion[];
  index: number;
  messageId: number | null;
  answers: Map<string, Answer>;
  /** True from the moment the question is closing: later taps are refused. */
  closed: boolean;
  /** The option buttons of the open question, kept so a countdown edit does not drop them. */
  keyboard?: InlineKeyboard;
  totals: Map<string, { name: string; points: number }>;
}

/** «p:<question index>:<option index>» from a price button. */
export function parsePriceCallback(data: string | undefined): { q: number; option: number } | null {
  const m = /^p:(\d{1,2}):([0-3])$/.exec(data ?? '');
  return m ? { q: Number(m[1]), option: Number(m[2]) } : null;
}

const label = (q: GroupPriceQuestion): string => (q.unitFa ? `${q.nameFa} (${q.unitFa})` : q.nameFa);

/**
 * Price mode inside a group (docs/logic/group-game.md §Price mode): `/price` asks a few four-choice price questions one after another.
 * Each member answers once per question; when the time is up the real price is revealed and right answers score into the weekly tally.
 */
export class GroupPriceGame {
  private readonly sessions = new Map<string, Session>();
  private readonly taps = new RateLimiter(GROUP_TAP_LIMIT, 60_000);

  constructor(private readonly d: GroupPriceDeps) {}

  async start(chatId: string): Promise<void> {
    if (this.sessions.has(chatId)) return void (await this.say(chatId, PRICE_TEXT.busy));
    const dateKey = dailyDateKey(this.d.now());
    if (!(await this.d.store.startPriceSession(chatId, dateKey, GROUP_PRICE_SESSIONS_PER_DAY))) return void (await this.cta(chatId, PRICE_TEXT.limit(GROUP_PRICE_SESSIONS_PER_DAY)));
    const questions = await this.d.draw(GROUP_PRICE_ROUNDS).catch((err) => (this.d.log?.('group: drawing price questions failed', err), []));
    if (questions.length === 0) return void (await this.say(chatId, PRICE_TEXT.unavailable));
    const s: Session = { dateKey, questions, index: 0, messageId: null, answers: new Map(), closed: false, totals: new Map() };
    this.sessions.set(chatId, s);
    await this.ask(chatId, s);
  }

  async tap(q: NonNullable<BaleUpdate['callback_query']>): Promise<void> {
    const chatId = q.message ? String(q.message.chat.id) : null;
    if (!chatId) return;
    const answer = (text?: string) => this.d.client.answerCallback?.(chatId, q.id, text).catch(() => undefined);
    const cb = parsePriceCallback(q.data)!;
    const s = this.sessions.get(chatId);
    if (!s || s.messageId !== q.message!.message_id || cb.q !== s.index) return void (await answer(PRICE_TEXT.closed));
    if (s.closed) return void (await answer(PRICE_TEXT.closed));
    const who = String(q.from.id);
    if (!this.taps.take(who)) return void (await answer());
    if (s.answers.has(who)) return void (await answer(PRICE_TEXT.already));
    s.answers.set(who, { name: q.from.first_name?.trim() || GROUP_TEXT.anon, choice: cb.option });
    await answer(PRICE_TEXT.locked);
  }

  private say(chatId: string, text: string): Promise<void> {
    return this.d.client.sendMessage(chatId, text).catch((err) => this.d.log?.('group: send failed', err));
  }

  private async cta(chatId: string, text: string): Promise<void> {
    const url = this.d.ctaUrl(chatId);
    if (url && this.d.client.sendInline) await this.d.client.sendInline(chatId, text, [[{ text: GROUP_TEXT.ctaButton, url }]]).catch((err) => this.d.log?.('group: send failed', err));
    else await this.say(chatId, text);
  }

  private async ask(chatId: string, s: Session): Promise<void> {
    const q = s.questions[s.index]!;
    s.answers = new Map();
    s.closed = false;
    const keyboard: InlineKeyboard = q.options.map((o, i) => [{ text: rialsToTomanString(o), callback_data: `p:${s.index}:${i}` }]);
    s.keyboard = keyboard;
    try {
      s.messageId = (await this.d.client.sendInline!(chatId, this.questionText(s, GROUP_PRICE_ROUND_MS), keyboard)).messageId;
    } catch (err) {
      this.sessions.delete(chatId);
      return void this.d.log?.('group: price question send failed', err);
    }
    const index = s.index;
    // the visible countdown: the same message is rewritten with the seconds left and how many answered (never what they chose)
    for (let left = GROUP_PRICE_ROUND_MS - GROUP_PRICE_TICK_MS; left > 0; left -= GROUP_PRICE_TICK_MS) {
      this.d.schedule(() => void this.tick(chatId, s, index, left).catch((err) => this.d.log?.('group: price countdown failed', err)), GROUP_PRICE_ROUND_MS - left);
    }
    this.d.schedule(() => void this.close(chatId, s, index).catch((err) => this.d.log?.('group: closing a price question failed', err)), GROUP_PRICE_ROUND_MS);
  }

  private questionText(s: Session, leftMs: number): string {
    const q = s.questions[s.index]!;
    return PRICE_TEXT.question(s.index + 1, s.questions.length, label(q), q.year, Math.round(leftMs / 1000), s.answers.size);
  }

  private async tick(chatId: string, s: Session, index: number, leftMs: number): Promise<void> {
    if (this.sessions.get(chatId) !== s || s.index !== index || s.closed || s.messageId === null || !s.keyboard) return;
    await this.d.client.editInline?.(chatId, s.messageId, this.questionText(s, leftMs), s.keyboard).catch((err) => this.d.log?.('group: edit failed', err));
  }

  private async close(chatId: string, s: Session, index: number): Promise<void> {
    if (this.sessions.get(chatId) !== s || s.index !== index || s.closed) return;
    s.closed = true;
    const q = s.questions[index]!;
    const rightIdx = q.options.findIndex((o) => o === q.actualRials);
    const weekKey = groupWeekKey(s.dateKey);
    const lines: string[] = [];
    for (const [who, a] of s.answers) {
      const ok = a.choice === rightIdx;
      lines.push(ok ? PRICE_TEXT.right(a.name, GROUP_PRICE_POINTS) : PRICE_TEXT.wrong(a.name));
      if (ok) {
        const t = s.totals.get(who) ?? { name: a.name, points: 0 };
        s.totals.set(who, { name: a.name, points: t.points + GROUP_PRICE_POINTS });
      }
      void this.d.record(chatId, weekKey, s.dateKey, { userRef: who, name: a.name, points: ok ? GROUP_PRICE_POINTS : 0, groups: 0, wrong: ok ? 0 : 1 }).catch((err) => this.d.log?.('group: saving the score failed', err));
    }
    const text = [PRICE_TEXT.reveal(index + 1, s.questions.length, label(q), q.year, rialsToTomanString(q.actualRials)), '', ...(lines.length > 0 ? lines : [PRICE_TEXT.nobody])].join('\n');
    if (s.messageId !== null) await this.d.client.editInline?.(chatId, s.messageId, text, []).catch((err) => this.d.log?.('group: edit failed', err));
    if (index + 1 < s.questions.length) {
      s.index = index + 1;
      s.closed = true; // between questions nothing is open
      this.d.schedule(() => void this.ask(chatId, s).catch((err) => this.d.log?.('group: next price question failed', err)), GROUP_PRICE_PAUSE_MS);
      return;
    }
    this.sessions.delete(chatId);
    const ranked = [...s.totals.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'fa')).slice(0, Math.min(3, GROUP_TOP_SIZE));
    const summary = [PRICE_TEXT.summaryTitle, '', ...(ranked.length > 0 ? ranked.map((r, i) => PRICE_TEXT.summaryRow(i + 1, r.name, r.points)) : [PRICE_TEXT.summaryNone]), '', GROUP_TEXT.cta].join('\n');
    await this.cta(chatId, summary);
  }
}
