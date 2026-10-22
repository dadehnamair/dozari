import { GROUP_QUESTION_PAUSE_MS, GROUP_QUESTION_POINTS, GROUP_QUESTION_ROUNDS, GROUP_QUESTION_ROUND_MS, GROUP_QUESTION_SESSIONS_PER_DAY, GROUP_QUESTION_TICK_MS, GROUP_TAP_LIMIT, GROUP_TOP_SIZE, dailyDateKey, groupWeekKey } from '@dozari/shared';
import type { BaleClient, BaleUpdate, InlineKeyboard } from '../notify/client.js';
import { RateLimiter } from '../security/rate-limit.js';
import type { ScoreDelta } from './record.js';
import type { GroupGameStore } from './store.js';
import { GROUP_TEXT, QUESTION_TEXT } from './texts.js';

/** One general question of a `/question` session. `correctIndex` never leaves the server before the reveal. */
export interface GroupTriviaQuestion {
  /** Topic name and its emoji (both optional), shown in the question header. */
  topicFa?: string | null;
  topicEmoji?: string | null;
  textFa: string;
  /** The four choices, already shuffled. */
  options: readonly string[];
  correctIndex: number;
  explanationFa: string;
}

export interface GroupTriviaDeps {
  store: GroupGameStore;
  client: BaleClient;
  /** Fresh questions from the approved bank (fewer, or none, when the bank is small). */
  draw: (count: number) => Promise<GroupTriviaQuestion[]>;
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
  questions: GroupTriviaQuestion[];
  index: number;
  messageId: number | null;
  answers: Map<string, Answer>;
  /** True from the moment the question is closing: later taps are refused. */
  closed: boolean;
  /** The option buttons of the open question, kept so a countdown edit does not drop them. */
  keyboard?: InlineKeyboard;
  totals: Map<string, { name: string; points: number }>;
}

/** «🍔 خوراکی» for the header; empty when the topic has neither a name nor an emoji. */
const topicTag = (q: GroupTriviaQuestion): string => [q.topicEmoji, q.topicFa].filter(Boolean).join(' ');

/** «q:<question index>:<option index>» from a question button. */
export function parseQuestionCallback(data: string | undefined): { q: number; option: number } | null {
  const m = /^q:(\d{1,2}):([0-3])$/.exec(data ?? '');
  return m ? { q: Number(m[1]), option: Number(m[2]) } : null;
}

/**
 * General-question mode inside a group (docs/logic/group-game.md §Question mode): `/question` asks a few four-choice questions from the
 * «پرسش‌های عمومی» bank one after another. Same flow as `/price`: one answer per member per question, the right choice and the winners
 * are revealed when time is up, right answers score into the weekly tally.
 */
export class GroupTriviaGame {
  private readonly sessions = new Map<string, Session>();
  private readonly taps = new RateLimiter(GROUP_TAP_LIMIT, 60_000);

  constructor(private readonly d: GroupTriviaDeps) {}

  async start(chatId: string): Promise<void> {
    if (this.sessions.has(chatId)) return void (await this.say(chatId, QUESTION_TEXT.busy));
    const dateKey = dailyDateKey(this.d.now());
    if (!(await this.d.store.startQuestionSession(chatId, dateKey, GROUP_QUESTION_SESSIONS_PER_DAY))) return void (await this.cta(chatId, QUESTION_TEXT.limit(GROUP_QUESTION_SESSIONS_PER_DAY)));
    const questions = await this.d.draw(GROUP_QUESTION_ROUNDS).catch((err) => (this.d.log?.('group: drawing questions failed', err), []));
    if (questions.length === 0) return void (await this.say(chatId, QUESTION_TEXT.unavailable));
    const s: Session = { dateKey, questions, index: 0, messageId: null, answers: new Map(), closed: false, totals: new Map() };
    this.sessions.set(chatId, s);
    await this.ask(chatId, s);
  }

  async tap(q: NonNullable<BaleUpdate['callback_query']>): Promise<void> {
    const chatId = q.message ? String(q.message.chat.id) : null;
    if (!chatId) return;
    const answer = (text?: string) => this.d.client.answerCallback?.(chatId, q.id, text).catch(() => undefined);
    const cb = parseQuestionCallback(q.data)!;
    const s = this.sessions.get(chatId);
    if (!s || s.messageId !== q.message!.message_id || cb.q !== s.index) return void (await answer(QUESTION_TEXT.closed));
    if (s.closed) return void (await answer(QUESTION_TEXT.closed));
    const who = String(q.from.id);
    if (!this.taps.take(who)) return void (await answer());
    if (s.answers.has(who)) return void (await answer(QUESTION_TEXT.already));
    s.answers.set(who, { name: q.from.first_name?.trim() || GROUP_TEXT.anon, choice: cb.option });
    await answer(QUESTION_TEXT.locked);
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
    const keyboard: InlineKeyboard = q.options.map((o, i) => [{ text: o, callback_data: `q:${s.index}:${i}` }]);
    s.keyboard = keyboard;
    try {
      s.messageId = (await this.d.client.sendInline!(chatId, this.questionText(s, GROUP_QUESTION_ROUND_MS), keyboard)).messageId;
    } catch (err) {
      this.sessions.delete(chatId);
      return void this.d.log?.('group: question send failed', err);
    }
    const index = s.index;
    // the visible countdown: the same message is rewritten with the seconds left and how many answered (never what they chose)
    for (let left = GROUP_QUESTION_ROUND_MS - GROUP_QUESTION_TICK_MS; left > 0; left -= GROUP_QUESTION_TICK_MS) {
      this.d.schedule(() => void this.tick(chatId, s, index, left).catch((err) => this.d.log?.('group: question countdown failed', err)), GROUP_QUESTION_ROUND_MS - left);
    }
    this.d.schedule(() => void this.close(chatId, s, index).catch((err) => this.d.log?.('group: closing a question failed', err)), GROUP_QUESTION_ROUND_MS);
  }

  private questionText(s: Session, leftMs: number): string {
    return QUESTION_TEXT.question(s.index + 1, s.questions.length, s.questions[s.index]!.textFa, Math.round(leftMs / 1000), s.answers.size, topicTag(s.questions[s.index]!));
  }

  private async tick(chatId: string, s: Session, index: number, leftMs: number): Promise<void> {
    if (this.sessions.get(chatId) !== s || s.index !== index || s.closed || s.messageId === null || !s.keyboard) return;
    await this.d.client.editInline?.(chatId, s.messageId, this.questionText(s, leftMs), s.keyboard).catch((err) => this.d.log?.('group: edit failed', err));
  }

  private async close(chatId: string, s: Session, index: number): Promise<void> {
    if (this.sessions.get(chatId) !== s || s.index !== index || s.closed) return;
    s.closed = true;
    const q = s.questions[index]!;
    const weekKey = groupWeekKey(s.dateKey);
    const lines: string[] = [];
    for (const [who, a] of s.answers) {
      const ok = a.choice === q.correctIndex;
      lines.push(ok ? QUESTION_TEXT.right(a.name, GROUP_QUESTION_POINTS) : QUESTION_TEXT.wrong(a.name));
      if (ok) {
        const t = s.totals.get(who) ?? { name: a.name, points: 0 };
        s.totals.set(who, { name: a.name, points: t.points + GROUP_QUESTION_POINTS });
      }
      void this.d.record(chatId, weekKey, s.dateKey, { userRef: who, name: a.name, points: ok ? GROUP_QUESTION_POINTS : 0, groups: 0, wrong: ok ? 0 : 1 }).catch((err) => this.d.log?.('group: saving the score failed', err));
    }
    const text = [QUESTION_TEXT.reveal(index + 1, s.questions.length, q.textFa, q.options[q.correctIndex] ?? '', q.explanationFa, topicTag(q)), '', ...(lines.length > 0 ? lines : [QUESTION_TEXT.nobody])].join('\n');
    if (s.messageId !== null) await this.d.client.editInline?.(chatId, s.messageId, text, []).catch((err) => this.d.log?.('group: edit failed', err));
    if (index + 1 < s.questions.length) {
      s.index = index + 1;
      s.closed = true; // between questions nothing is open
      this.d.schedule(() => void this.ask(chatId, s).catch((err) => this.d.log?.('group: next question failed', err)), GROUP_QUESTION_PAUSE_MS);
      return;
    }
    this.sessions.delete(chatId);
    const ranked = [...s.totals.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'fa')).slice(0, Math.min(3, GROUP_TOP_SIZE));
    const summary = [QUESTION_TEXT.summaryTitle, '', ...(ranked.length > 0 ? ranked.map((r, i) => QUESTION_TEXT.summaryRow(i + 1, r.name, r.points)) : [QUESTION_TEXT.summaryNone]), '', GROUP_TEXT.cta].join('\n');
    await this.cta(chatId, summary);
  }
}
