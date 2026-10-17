import { randomInt } from 'node:crypto';
import { GROUP_ROUND_TTL_MS, GROUP_TAP_LIMIT, GROUP_SIZE, SOLO_MAX_MISTAKES, dailyDateKey, mulberry32, shuffleBoard, startSolo, submitGuess } from '@dozari/shared';
import type { Rng, SoloState } from '@dozari/shared';
import type { BaleClient, BaleUpdate } from '../notify/client.js';
import { isTelegramId } from '../notify/client.js';
import { RateLimiter } from '../security/rate-limit.js';
import type { ServedPuzzle } from '../solo/types.js';
import { parseCallback, renderBoard } from './render.js';
import type { BoardView } from './render.js';
import type { GroupGameStore } from './store.js';
import { GROUP_TEXT, fa } from './texts.js';

export interface GroupGameDeps {
  store: GroupGameStore;
  client: BaleClient;
  /** Today's daily puzzle (same one as in the app), or null when none is set. */
  todayPuzzle: (dateKey: string) => Promise<ServedPuzzle | null>;
  /** Bot usernames for the mini-app deep link (without «@»). */
  usernames: { bale: string | null; telegram: string | null };
  now?: () => number;
  newSeed?: () => number;
  log?: (msg: string, err?: unknown) => void;
}

interface Round {
  dateKey: string;
  puzzle: ServedPuzzle;
  state: SoloState;
  rng: Rng;
  selection: string[];
  rev: number;
  messageId: number | null;
  players: Set<string>;
  note: string;
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
  private readonly now: () => number;
  private readonly newSeed: () => number;

  constructor(private readonly d: GroupGameDeps) {
    this.now = d.now ?? Date.now;
    this.newSeed = d.newSeed ?? (() => randomInt(0, 2 ** 31));
  }

  /** True when this update belongs to a group (or is one of our buttons) and was handled here. */
  async handleUpdate(u: BaleUpdate): Promise<boolean> {
    if (u.callback_query) {
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
    if (!m || !isGroupType(m.chat.type)) return false;
    const chatId = String(m.chat.id);
    const cmd = (m.text ?? '').trim().split(/\s+/)[0]?.toLowerCase().replace(/@.*$/, '') ?? '';
    if (cmd === '/play' || cmd === '/start' || cmd === '/help') {
      await this.register(chatId, m.chat.title ?? '');
      if (cmd === '/play') await this.play(chatId);
      else await this.say(chatId, cmd === '/start' ? GROUP_TEXT.welcome : GROUP_TEXT.help);
    }
    // anything else typed in a group is none of our business (and must never reach the private link-code flow)
    return true;
  }

  private platformOf(chatId: string): 'bale' | 'telegram' {
    return isTelegramId(chatId) ? 'telegram' : 'bale';
  }

  private register(chatId: string, title: string): Promise<void> {
    return this.d.store.upsertGroup({ chatId, platform: this.platformOf(chatId), title });
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
    return user ? `${tg ? 'https://t.me' : 'https://ble.ir'}/${user}?startapp=daily` : null;
  }

  private async say(chatId: string, text: string): Promise<void> {
    await this.d.client.sendMessage(chatId, text).catch((err) => this.d.log?.('group: send failed', err));
  }

  private view(chatId: string, r: Round): BoardView {
    return { puzzle: r.puzzle, state: r.state, selection: r.selection, rev: r.rev, maxMistakes: SOLO_MAX_MISTAKES, dateFa: dateFa(r.dateKey), note: r.note, players: r.players.size, ctaUrl: this.ctaUrl(chatId) };
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
      const rng = mulberry32(this.newSeed());
      round = { dateKey, puzzle, state: startSolo(puzzle, rng), rng, selection: [], rev: 0, messageId: null, players: new Set(), note: '', touchedAt: this.now() };
      this.rounds.set(chatId, round);
    }
    await this.d.store.startPlay(chatId, dateKey);
    round.rev += 1; // the older board message stops answering
    round.touchedAt = this.now();
    const { text, keyboard } = renderBoard(this.view(chatId, round));
    try {
      round.messageId = (await this.d.client.sendInline!(chatId, text, keyboard)).messageId;
    } catch (err) {
      this.rounds.delete(chatId);
      this.d.log?.('group: board send failed', err);
    }
  }

  private async onTap(q: NonNullable<BaleUpdate['callback_query']>): Promise<void> {
    const chatId = q.message ? String(q.message.chat.id) : null;
    if (!chatId) return;
    const answer = (text?: string) => this.d.client.answerCallback?.(chatId, q.id, text).catch(() => undefined);
    const cb = parseCallback(q.data)!;
    const round = this.rounds.get(chatId);
    if (!round || round.messageId !== q.message!.message_id) return void (await answer(GROUP_TEXT.gone));
    const who = String(q.from.id);
    if (!this.taps.take(who)) return void (await answer());
    round.touchedAt = this.now();
    if (cb.rev !== round.rev) {
      await answer(GROUP_TEXT.stale);
      return void (await this.redraw(chatId, round));
    }

    const name = q.from.first_name?.trim() || GROUP_TEXT.anon;
    let toast: string | undefined;
    const a = cb.action;
    if (a === 'c') {
      round.selection = [];
      round.note = '';
    } else if (a === 'h') {
      round.state = shuffleBoard(round.state, round.rng);
    } else if (a === 's') {
      if (round.selection.length !== GROUP_SIZE) toast = GROUP_TEXT.pickFour;
      else {
        round.players.add(who);
        const r = submitGuess(round.state, round.puzzle, round.selection, SOLO_MAX_MISTAKES);
        round.state = r.state;
        round.selection = [];
        round.note = r.outcome === 'correct' ? GROUP_TEXT.noteCorrect(name) : r.outcome === 'one_away' ? GROUP_TEXT.noteOneAway(name) : r.outcome === 'duplicate' ? GROUP_TEXT.noteDuplicate(name) : GROUP_TEXT.noteWrong(name);
      }
    } else {
      const id = round.state.remaining[a.card];
      if (!id) return void (await answer(GROUP_TEXT.stale));
      if (round.selection.includes(id)) round.selection = round.selection.filter((x) => x !== id);
      else if (round.selection.length >= GROUP_SIZE) toast = GROUP_TEXT.maxFour;
      else round.selection = [...round.selection, id];
    }
    if (toast) return void (await answer(toast));
    round.rev += 1;
    await answer();
    await this.redraw(chatId, round);
    if (round.state.status !== 'playing') await this.finish(chatId, round);
  }

  private async redraw(chatId: string, round: Round): Promise<void> {
    if (round.messageId === null) return;
    const { text, keyboard } = renderBoard(this.view(chatId, round));
    // a rejected edit (not modified, message deleted) must never break the round
    await this.d.client.editInline?.(chatId, round.messageId, text, keyboard).catch((err) => this.d.log?.('group: edit failed', err));
  }

  private async finish(chatId: string, round: Round): Promise<void> {
    this.rounds.delete(chatId);
    const s = round.state;
    await this.d.store
      .finishPlay(chatId, round.dateKey, { result: s.status === 'won' ? 'won' : 'lost', mistakes: s.mistakes, solvedGroups: s.solved.filter((g) => !g.revealed).length, players: round.players.size })
      .catch((err) => this.d.log?.('group: saving the result failed', err));
  }
}

function isGroupType(type: string | undefined): boolean {
  return type !== undefined && type !== 'private' && type !== 'channel';
}
