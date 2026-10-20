import { randomInt } from 'node:crypto';
import { normalizeTableCode, GROUP_PLAY_MS, GROUP_PLAY_REMIND_MS, GROUP_ROUND_TTL_MS, GROUP_TAP_LIMIT, GROUP_TOP_SIZE, GROUP_COUNT, GROUP_SIZE, SOLO_MAX_MISTAKES, dailyDateKey, groupPoints, groupWeekKey, mulberry32, rankGroupScores, startSolo, submitGuess } from '@dozari/shared';
import type { SoloState } from '@dozari/shared';
import type { BaleClient, BaleUpdate } from '../notify/client.js';
import { isTelegramId } from '../notify/client.js';
import { RateLimiter } from '../security/rate-limit.js';
import type { ServedPuzzle } from '../solo/types.js';
import { GroupPriceGame, parsePriceCallback } from './price.js';
import type { GroupPriceQuestion } from './price.js';
import { GroupTriviaGame, parseQuestionCallback } from './trivia.js';
import type { GroupTriviaQuestion } from './trivia.js';
import { parseCallback, rankPlayers, renderBoard, renderResults } from './render.js';
import type { PlayerResult } from './render.js';
import type { GroupGameStore } from './store.js';
import { GROUP_TEXT, TABLE_TEXT, fa } from './texts.js';

/** What a group card shows about a private table. */
export interface GroupTableCard {
  code: string;
  name: string;
  format: '1v1' | '2v2';
  entryFee: number;
  seats: number;
  taken: number;
  hostNickname: string;
}

export interface GroupGameDeps {
  store: GroupGameStore;
  client: BaleClient;
  /** Today's daily puzzle (same one as in the app), or null when none is set. */
  todayPuzzle: (dateKey: string) => Promise<ServedPuzzle | null>;
  /** Price-mode questions (phase 3); absent = no `/price`. */
  drawPrices?: (count: number) => Promise<GroupPriceQuestion[]>;
  /** General questions (`/question`); absent = no `/question`. */
  drawQuestions?: (count: number) => Promise<GroupTriviaQuestion[]>;
  /** A joinable table by code, for `/table CODE`; absent = no table cards. */
  tableCard?: (code: string) => GroupTableCard | null;
  /** Runs a function later (a timer in production, a manual queue in tests). */
  schedule?: (fn: () => void, ms: number) => void;
  /** Bot usernames for the mini-app deep link (without «@»). */
  usernames: { bale: string | null; telegram: string | null };
  now?: () => number;
  newSeed?: () => number;
  log?: (msg: string, err?: unknown) => void;
}

/** One member's own game on the shared board. Nobody else ever sees any of it before the round closes. */
interface Player {
  name: string;
  state: SoloState;
  selection: string[];
  lastSolvedAt: number;
}

interface Round {
  dateKey: string;
  puzzle: ServedPuzzle;
  /** The one card order every member plays on. */
  order: readonly string[];
  players: Map<string, Player>;
  rev: number;
  messageId: number | null;
  endsAt: number;
  touchedAt: number;
}

/** Jalali-free display of the Tehran date key for the board title (YYYY-MM-DD, Persian digits). */
const dateFa = (dateKey: string): string => fa(dateKey.replaceAll('-', '/'));

/**
 * The bot inside a Bale/Telegram group (docs/logic/group-game.md): one shared board per group, edited in place, today's daily puzzle,
 * one play per group per day. Rounds live in memory; the result row is the one-play rule.
 */
export class GroupGameService {
  private readonly rounds = new Map<string, Round>();
  private readonly taps = new RateLimiter(GROUP_TAP_LIMIT, 60_000);
  /** Table cards per group: a card is a loud message, so a few a minute. */
  private readonly cards = new RateLimiter(3, 60_000);
  /** Answers to «someone said our name»: one a minute per group, so chatter about the game never turns into bot spam. */
  private readonly calls = new RateLimiter(1, 60_000);
  private readonly price?: GroupPriceGame;
  private readonly trivia?: GroupTriviaGame;
  private readonly now: () => number;
  private readonly newSeed: () => number;

  constructor(private readonly d: GroupGameDeps) {
    this.now = d.now ?? Date.now;
    this.newSeed = d.newSeed ?? (() => randomInt(0, 2 ** 31));
    if (d.drawQuestions) {
      this.trivia = new GroupTriviaGame({
        store: d.store,
        client: d.client,
        draw: d.drawQuestions,
        ctaUrl: (chatId) => this.ctaUrl(chatId),
        schedule: d.schedule ?? ((fn, ms) => void setTimeout(fn, ms).unref()),
        now: this.now,
        log: d.log,
      });
    }
    if (d.drawPrices) {
      this.price = new GroupPriceGame({
        store: d.store,
        client: d.client,
        draw: d.drawPrices,
        ctaUrl: (chatId) => this.ctaUrl(chatId),
        schedule: d.schedule ?? ((fn, ms) => void setTimeout(fn, ms).unref()),
        now: this.now,
        log: d.log,
      });
    }
  }

  /** True when this update belongs to a group (or is one of our buttons) and was handled here. */
  async handleUpdate(u: BaleUpdate): Promise<boolean> {
    if (u.callback_query) {
      if (this.price && parsePriceCallback(u.callback_query.data)) {
        await this.price.tap(u.callback_query);
        return true;
      }
      if (this.trivia && parseQuestionCallback(u.callback_query.data)) {
        await this.trivia.tap(u.callback_query);
        return true;
      }
      if (!parseCallback(u.callback_query.data)) return false;
      await this.onTap(u.callback_query);
      return true;
    }
    if (u.my_chat_member) {
      const c = u.my_chat_member.chat;
      if (!isGroupType(c.type)) return false;
      await this.onMembership(String(c.id), c.title ?? '', u.my_chat_member.new_chat_member.status);
      return true;
    }
    const m = u.message;
    if (!m || !isGroupChat(m.chat, m.from)) return false;
    const chatId = String(m.chat.id);
    const cmd = (m.text ?? '').trim().split(/\s+/)[0]?.toLowerCase().replace(/@.*$/, '') ?? '';
    if (cmd === '/play' || cmd === '/price' || cmd === '/question' || cmd === '/table' || cmd === '/top' || cmd === '/start' || cmd === '/help') {
      await this.register(chatId, m.chat.title ?? '');
      if (cmd === '/play') await this.play(chatId);
      else if (cmd === '/price' && this.price) await this.price.start(chatId);
      else if (cmd === '/question' && this.trivia) await this.trivia.start(chatId);
      else if (cmd === '/table' && this.d.tableCard) await this.tableCard(chatId, m.text ?? '');
      else if (cmd === '/top') await this.top(chatId);
      else await this.say(chatId, cmd === '/start' ? GROUP_TEXT.welcome : GROUP_TEXT.help);
    }
    else if (this.isCalled(m.text ?? '') && this.calls.take(chatId)) await this.say(chatId, GROUP_TEXT.welcome);
    // anything else typed in a group is none of our business (and must never reach the private link-code flow)
    return true;
  }

  /** The bot is spoken to by name («دوزاری», «@bot_username») rather than by command. */
  private isCalled(text: string): boolean {
    const t = text.toLowerCase();
    if (t.includes('دوزاری')) return true;
    return [this.d.usernames.bale, this.d.usernames.telegram].some((u) => !!u && t.includes(`@${u.toLowerCase()}`));
  }

  private platformOf(chatId: string): 'bale' | 'telegram' {
    return isTelegramId(chatId) ? 'telegram' : 'bale';
  }

  /** Link codes of the groups seen since start-up, so the (synchronous) button builders can use them. */
  private readonly refs = new Map<string, string>();

  private async register(chatId: string, title: string): Promise<void> {
    await this.d.store.upsertGroup({ chatId, platform: this.platformOf(chatId), title });
    if (!this.refs.has(chatId)) {
      const ref = await this.d.store.refOf(chatId).catch(() => null);
      if (ref) this.refs.set(chatId, ref);
    }
  }

  private async onMembership(chatId: string, title: string, status: string): Promise<void> {
    if (status === 'member' || status === 'administrator') {
      await this.register(chatId, title);
      await this.say(chatId, GROUP_TEXT.welcome);
    } else if (status === 'left' || status === 'kicked') {
      this.rounds.delete(chatId);
      await this.d.store.markRemoved(chatId);
    }
  }

  private ctaUrl(chatId: string): string | null {
    const tg = this.platformOf(chatId) === 'telegram';
    const user = tg ? this.d.usernames.telegram : this.d.usernames.bale;
    // «daily_g<ref>»: the screen plus which group the player came from (docs/logic/group-game.md §Funnel)
    const ref = this.refs.get(chatId);
    return user ? `${tg ? 'https://t.me' : 'https://ble.ir'}/${user}?startapp=daily${ref ? `_g${ref}` : ''}` : null;
  }

  private async say(chatId: string, text: string): Promise<void> {
    await this.d.client.sendMessage(chatId, text).catch((err) => this.d.log?.('group: send failed', err));
  }

  private sweep(): void {
    const cutoff = this.now() - GROUP_ROUND_TTL_MS;
    for (const [k, r] of this.rounds) if (r.touchedAt < cutoff) this.rounds.delete(k);
  }

  /** `/play`: start today's board, re-send a live one, or say it is already done. */
  private async play(chatId: string): Promise<void> {
    this.sweep();
    const dateKey = dailyDateKey(this.now());
    const done = await this.d.store.play(chatId, dateKey);
    if (done && done.result !== 'playing') {
      const cta = this.ctaUrl(chatId);
      const text = `${GROUP_TEXT.alreadyPlayed(done.result === 'won')}\n\n${GROUP_TEXT.cta}`;
      if (cta) await this.d.client.sendInline?.(chatId, text, [[{ text: GROUP_TEXT.ctaButton, url: cta }]]).catch((err) => this.d.log?.('group: send failed', err));
      else await this.say(chatId, text);
      return;
    }
    let round = this.rounds.get(chatId);
    if (!round || round.dateKey !== dateKey) {
      const puzzle = await this.d.todayPuzzle(dateKey);
      if (!puzzle) return void (await this.say(chatId, GROUP_TEXT.unavailable));
      const order = startSolo(puzzle, mulberry32(this.newSeed())).remaining;
      round = { dateKey, puzzle, order, players: new Map(), rev: 0, messageId: null, endsAt: this.now() + GROUP_PLAY_MS, touchedAt: this.now() };
      this.rounds.set(chatId, round);
      this.armTimers(chatId, round);
    }
    await this.d.store.startPlay(chatId, dateKey);
    round.rev += 1; // the older board message stops answering
    round.touchedAt = this.now();
    const { text, keyboard } = renderBoard({ puzzle: round.puzzle, order: round.order, rev: round.rev, dateFa: dateFa(round.dateKey), minutes: Math.max(1, Math.ceil((round.endsAt - this.now()) / 60_000)) });
    try {
      round.messageId = (await this.d.client.sendInline!(chatId, text, keyboard)).messageId;
    } catch (err) {
      this.rounds.delete(chatId);
      this.d.log?.('group: board send failed', err);
    }
  }

  /** The five-minutes-left reminder and the closing bell of a round (timers are in memory; a restart drops them with the round). */
  private armTimers(chatId: string, round: Round): void {
    const schedule = this.d.schedule ?? ((fn, ms) => void setTimeout(fn, ms).unref());
    const live = () => this.rounds.get(chatId) === round;
    schedule(() => void this.remind(chatId, round, live).catch((err) => this.d.log?.('group: reminder failed', err)), GROUP_PLAY_MS - GROUP_PLAY_REMIND_MS);
    schedule(() => void (live() && this.finish(chatId, round)), GROUP_PLAY_MS);
  }

  private async remind(chatId: string, round: Round, live: () => boolean): Promise<void> {
    if (!live()) return;
    await this.say(chatId, GROUP_TEXT.remind(Math.round(GROUP_PLAY_REMIND_MS / 60_000), round.players.size));
  }

  /** `/table CODE`: a card with a button that opens the mini-app straight on that private table. */
  private async tableCard(chatId: string, text: string): Promise<void> {
    const code = normalizeTableCode(text.trim().split(/\s+/)[1] ?? '');
    if (!code) return void (await this.say(chatId, TABLE_TEXT.usage));
    if (!this.cards.take(chatId)) return void (await this.say(chatId, TABLE_TEXT.slow));
    const t = this.d.tableCard!(code);
    const url = this.tableUrl(chatId, code);
    if (!t || !url || !this.d.client.sendInline) return void (await this.say(chatId, TABLE_TEXT.notFound));
    const body = TABLE_TEXT.card(t.name, t.hostNickname, t.format === '2v2' ? '۲ به ۲' : '۱ به ۱', t.taken, t.seats, t.entryFee, t.code);
    await this.d.client.sendInline(chatId, body, [[{ text: TABLE_TEXT.button, url }]]).catch((err) => this.d.log?.('group: send failed', err));
  }

  /** `?startapp=table_<CODE>_g<ref>`: opens the table in the mini-app and says which group sent the player. */
  private tableUrl(chatId: string, code: string): string | null {
    const tg = this.platformOf(chatId) === 'telegram';
    const user = tg ? this.d.usernames.telegram : this.d.usernames.bale;
    const ref = this.refs.get(chatId);
    return user ? `${tg ? 'https://t.me' : 'https://ble.ir'}/${user}?startapp=table_${code}${ref ? `_g${ref}` : ''}` : null;
  }

  /** `/top`: this week's members of the group, best first. */
  private async top(chatId: string): Promise<void> {
    const rows = rankGroupScores(await this.d.store.weekScores(chatId, groupWeekKey(dailyDateKey(this.now())), GROUP_TOP_SIZE)).slice(0, GROUP_TOP_SIZE);
    if (rows.length === 0) return void (await this.say(chatId, GROUP_TEXT.topEmpty));
    const lines = rows.map((r, i) => GROUP_TEXT.topRow(i + 1, r.name || GROUP_TEXT.anon, r.points, r.groups));
    await this.say(chatId, [GROUP_TEXT.topTitle, '', ...lines, '', GROUP_TEXT.topFooter].join('\n'));
  }

  /** A member's tap. Whatever it does is answered to them alone (a toast); the group's message is never edited by a tap. */
  private async onTap(q: NonNullable<BaleUpdate['callback_query']>): Promise<void> {
    const chatId = q.message ? String(q.message.chat.id) : null;
    if (!chatId) return;
    const answer = (text?: string) => this.d.client.answerCallback?.(chatId, q.id, text).catch(() => undefined);
    const cb = parseCallback(q.data)!;
    const round = this.rounds.get(chatId);
    if (!round || round.messageId !== q.message!.message_id) return void (await answer(GROUP_TEXT.gone));
    if (this.now() >= round.endsAt) {
      await answer(GROUP_TEXT.timeUp);
      return void (await this.finish(chatId, round));
    }
    const who = String(q.from.id);
    if (!this.taps.take(who)) return void (await answer());
    round.touchedAt = this.now();
    const name = q.from.first_name?.trim() || GROUP_TEXT.anon;
    let p = round.players.get(who);
    if (!p) {
      p = { name, state: startSolo(round.puzzle, mulberry32(0)), selection: [], lastSolvedAt: 0 };
      p.state = { ...p.state, remaining: [...round.order] };
      round.players.set(who, p);
    }
    p.name = name;
    if (p.state.status !== 'playing') return void (await answer(GROUP_TEXT.alreadyDone));

    const a = cb.action;
    if (a === 'h') return void (await answer(GROUP_TEXT.shuffleGone));
    if (a === 'c') {
      p.selection = [];
      return void (await answer(GROUP_TEXT.cleared));
    }
    if (a === 's') return void (await answer(await this.submit(chatId, round, who, p)));
    const id = round.order[a.card];
    if (!id) return void (await answer(GROUP_TEXT.gone));
    if (!p.state.remaining.includes(id)) return void (await answer(GROUP_TEXT.cardSolved));
    const label = round.puzzle.items[id]?.nameFa ?? '';
    if (p.selection.includes(id)) {
      p.selection = p.selection.filter((x) => x !== id);
      return void (await answer(GROUP_TEXT.unpicked(label, p.selection.length)));
    }
    if (p.selection.length >= GROUP_SIZE) return void (await answer(GROUP_TEXT.maxFour));
    p.selection = [...p.selection, id];
    await answer(GROUP_TEXT.picked(label, p.selection.length, p.selection.map((x) => round.puzzle.items[x]?.nameFa ?? '').join('، ')));
  }

  /** The text only the submitter sees. */
  private async submit(chatId: string, round: Round, who: string, p: Player): Promise<string> {
    if (p.selection.length !== GROUP_SIZE) return GROUP_TEXT.pickFour;
    const r = submitGuess(p.state, round.puzzle, p.selection, SOLO_MAX_MISTAKES);
    p.selection = [];
    if (r.outcome === 'invalid') return GROUP_TEXT.pickFour;
    if (r.outcome === 'duplicate') return GROUP_TEXT.mineDuplicate;
    p.state = r.state;
    const found = foundGroups(p.state);
    const correct = r.outcome === 'correct';
    if (correct) p.lastSolvedAt = this.now();
    const points = correct && r.solvedLevel !== undefined ? groupPoints(r.solvedLevel) : 0;
    // the tally must never break the round
    void this.d.store.addScore(chatId, groupWeekKey(round.dateKey), { userRef: who, name: p.name, points, groups: correct ? 1 : 0, wrong: correct ? 0 : 1 }).catch((err) => this.d.log?.('group: saving the score failed', err));
    if (p.state.status === 'won') return GROUP_TEXT.mineWon(p.state.mistakes);
    if (p.state.status === 'lost') return GROUP_TEXT.mineLost(found);
    const left = SOLO_MAX_MISTAKES - p.state.mistakes;
    if (correct) return GROUP_TEXT.mineCorrect(round.puzzle.groups.find((g) => g.level === r.solvedLevel)?.titleFa ?? '', found);
    return r.outcome === 'one_away' ? GROUP_TEXT.mineOneAway(left) : GROUP_TEXT.mineWrong(left);
  }

  /** Time is up: lock the board, announce everyone's result, record the day's play. Runs once per round. */
  private async finish(chatId: string, round: Round): Promise<void> {
    if (this.rounds.get(chatId) !== round) return;
    this.rounds.delete(chatId);
    const results: PlayerResult[] = [...round.players.values()].map((p) => ({ name: p.name, groups: foundGroups(p.state), mistakes: p.state.mistakes, lastSolvedAt: p.lastSolvedAt }));
    const ranked = rankPlayers(results);
    const best = ranked[0];
    await this.d.store
      .finishPlay(chatId, round.dateKey, {
        result: best && best.groups === GROUP_COUNT ? 'won' : 'lost',
        mistakes: results.reduce((n, r) => n + r.mistakes, 0),
        solvedGroups: best?.groups ?? 0,
        players: round.players.size,
      })
      .catch((err) => this.d.log?.('group: saving the result failed', err));
    if (round.messageId !== null) await this.d.client.editInline?.(chatId, round.messageId, GROUP_TEXT.closedBoard(dateFa(round.dateKey)), []).catch((err) => this.d.log?.('group: edit failed', err));
    const text = renderResults({ puzzle: round.puzzle, dateFa: dateFa(round.dateKey), ranked, maxRows: GROUP_TOP_SIZE });
    const cta = this.ctaUrl(chatId);
    if (cta && this.d.client.sendInline) await this.d.client.sendInline(chatId, text, [[{ text: GROUP_TEXT.ctaButton, url: cta }]]).catch((err) => this.d.log?.('group: send failed', err));
    else await this.say(chatId, text);
  }
}

/** Groups a member found themselves (the last group the game fills in on its own does not count unless they won). */
function foundGroups(s: SoloState): number {
  return s.status === 'won' ? GROUP_COUNT : s.solved.filter((g) => !g.revealed).length;
}

function isGroupType(type: string | undefined): boolean {
  return type !== undefined && type !== 'private' && type !== 'channel';
}

/** A host that sends no `type` still gives it away: a private chat's id is the user's id, a group's is not. */
function isGroupChat(chat: { id: number | string; type?: string }, from?: { id: number | string }): boolean {
  if (chat.type !== undefined) return isGroupType(chat.type);
  return from !== undefined && String(from.id) !== String(chat.id);
}
