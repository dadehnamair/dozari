import { randomInt } from 'node:crypto';
import { ServerEvent, TRIVIA_DUEL_INTRO_MS, TRIVIA_DUEL_REMATCH_SECONDS, applyTriviaCommand, mulberry32, startTriviaRound, toTriviaRoundView, triviaPoints, triviaWinner } from '@dozari/shared';
import type { AgeTrack, DuelReason, ErrorCode, Rng, Stake, TduelEnded, TduelFound, TduelState, TriviaRoundQuestion, TriviaRoundState } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';
import type { PlayerProfile } from './match-service.js';

export interface TriviaDuelDeps {
  emit(userId: string, event: string, payload: unknown): void;
  profile(userId: string): Promise<PlayerProfile | null>;
  /** The question pools a player may draw from (their age track). Players are only paired when theirs are the same. Absent = adult. */
  poolOf?: (userId: string) => Promise<readonly AgeTrack[]>;
  /** Questions for one game, choices already shuffled; `topicId` absent = a mix of the whole bank. [] = nothing to ask. */
  /** `userIds` are the human players: the draw prefers questions none of them has seen (docs/logic/trivia.md §No repeats). */
  questions(o: { topicId?: string; tracks: readonly AgeTrack[]; count: number; rng: Rng; userIds: readonly string[] }): Promise<TriviaRoundQuestion[]>;
  /** A question was revealed to these human players: they have now seen it. Must not throw. */
  markSeen?: (userIds: readonly string[], questionId: string) => void;
  /** A question was revealed: how many humans answered it and how many were right (the measured difficulty and the author's play counter). Must not throw. */
  onRevealed?: (r: { questionId: string; answers: number; right: number }) => void;
  topicName(topicId: string): Promise<string | null>;
  settings(): Promise<{ questions: number; seconds: number }>;
  /** A non-null answer refuses the join (maintenance, feature switched off, the player's age track). */
  gate?: (userId: string) => Promise<ErrorCode | null>;
  /** True when the player is already in a board duel or its queue. */
  busy?: (userId: string) => boolean;
  /** Coins (docs/logic/trivia.md §Coins): the entry fee each side puts down, the payout, the refund of a game that could not start. Absent = free. */
  stakes?: {
    canAffordDuel(userId: string, mix?: boolean): Promise<boolean>;
    openDuel(matchId: string, players: readonly [string, string], mix?: boolean): Promise<{ ok: true; stakes: [Stake, Stake]; fee: number } | { ok: false; broke: string }>;
    cancelDuel(matchId: string, players: readonly [string, string], stakes: readonly [Stake, Stake], fee: number): Promise<void>;
    settleDuel(matchId: string, players: readonly [string, string], stakes: readonly [Stake, Stake], fee: number, result: { winner: 0 | 1 | null; reason: DuelReason }): Promise<[number, number]>;
  };
  /** Bot accounts take a rematch at once and never pay a leave penalty. */
  isBot?: (userId: string) => boolean;
  /** A human left a running game on purpose (feeds the leave penalty, like a board duel); must not throw. */
  onLeave?: (i: { userId: string; matchId: string }) => void;
  /** A game ended with a winner or a draw (bots included); must not throw. */
  onEnded?: (r: { matchId: string; players: [string, string]; winner: 0 | 1 | null; reason: 'played' | 'forfeit' }) => void;
  /** How long a rematch can be asked for after a played game; absent = the shared default. */
  rematchSeconds?: number;
  /** How long the versus card shows before the first question opens; absent = the shared default, 0 = open at once. */
  introMs?: number;
  now?: () => number;
  newSeed?: () => number;
  schedule?: (ms: number, fn: () => void) => () => void;
}

interface Waiting {
  since: number;
  topicId: string | null;
  /** The «ترکیبی» search: the whole bank at higher stakes, paired only with another mix search (or a bot). */
  mix: boolean;
  poolKey: string;
}

interface Active {
  id: string;
  players: [string, string];
  state: TriviaRoundState;
  endsAt: number;
  /** Seconds to answer each question (the setting as it was when the game began). */
  seconds: number;
  /** False during the versus card: no snapshot is pushed and no answer is taken yet. */
  ready: boolean;
  cancel: (() => void) | null;
  topicNameFa: string | null;
  topicId?: string;
  mix: boolean;
  /** How each seat entered (paid / house / free) and the fee, once coins are on. */
  stakes?: [Stake, Stake];
  fee: number;
  found: [TduelFound, TduelFound];
}

/** A finished game whose sides may still ask for another one. */
interface Recent {
  players: [string, string];
  topicId?: string;
  mix: boolean;
  asked: Set<string>;
  cancel: () => void;
}

type StartResult = 'ok' | 'fail' | { broke: string };

const defaultSchedule = (ms: number, fn: () => void): (() => void) => {
  const t = setTimeout(fn, ms);
  t.unref();
  return () => clearTimeout(t);
};

/**
 * The question duel (docs/logic/trivia.md §Question duel): two players meet through a search (a topic, or random), then answer the same
 * four-choice questions blind and at the same time. In memory like the other live matches; the round itself is the shared pure state machine.
 * A topic player meets a player of the same topic or a random one; two random players get a mix.
 */
export class TriviaDuelService {
  private readonly waiting = new Map<string, Waiting>();
  private readonly matches = new Map<string, Active>();
  private readonly byUser = new Map<string, string>();
  /** Per player: the game they just finished and may rematch. */
  private readonly recent = new Map<string, Recent>();
  private readonly now: () => number;
  private readonly newSeed: () => number;
  private readonly schedule: (ms: number, fn: () => void) => () => void;

  constructor(private readonly deps: TriviaDuelDeps) {
    this.now = deps.now ?? Date.now;
    this.newSeed = deps.newSeed ?? (() => randomInt(0, 2 ** 31));
    this.schedule = deps.schedule ?? defaultSchedule;
  }

  inMatch(userId: string): boolean {
    return this.byUser.has(userId);
  }

  isWaiting(userId: string): boolean {
    return this.waiting.has(userId);
  }

  get activeCount(): number {
    return this.matches.size;
  }

  /** Everyone in line, longest waiting first (for the status pushes and the bot driver). */
  queued(): { userId: string; since: number; topicId: string | null }[] {
    return [...this.waiting].map(([userId, w]) => ({ userId, since: w.since, topicId: w.topicId }));
  }

  /** The opponent of a player in a live game (a bot driver needs it only to know the game is on). */
  opponentOf(userId: string): string | null {
    const e = this.entryOf(userId);
    return e ? e.players[e.players[0] === userId ? 1 : 0] : null;
  }

  private entryOf(userId: string): Active | undefined {
    const id = this.byUser.get(userId);
    return id ? this.matches.get(id) : undefined;
  }

  private async poolKey(userId: string): Promise<{ tracks: readonly AgeTrack[]; key: string }> {
    const tracks = (await this.deps.poolOf?.(userId).catch(() => undefined)) ?? ['adult' as const];
    return { tracks, key: [...tracks].sort().join('|') };
  }

  /** Puts a player in line for a topic (or random) and pairs them at once when someone fitting is waiting. */
  async join(userId: string, topicIdIn?: string, mix = false): Promise<{ ok: true } | { ok: false; error: ErrorCode }> {
    const refused = await this.deps.gate?.(userId);
    if (refused) return { ok: false, error: refused };
    if (this.byUser.has(userId) || this.deps.busy?.(userId)) return { ok: false, error: 'ALREADY_IN_MATCH' };
    if (this.waiting.has(userId)) return { ok: false, error: 'ALREADY_QUEUED' };
    const topicId = mix ? undefined : topicIdIn;
    if (this.deps.stakes && !(await this.deps.stakes.canAffordDuel(userId, mix))) return { ok: false, error: 'INSUFFICIENT_COINS' };
    const { tracks, key } = await this.poolKey(userId);
    // A topic with nothing to ask must be told at once, not left to search forever.
    const sample = await this.deps.questions({ topicId, tracks, count: 1, rng: mulberry32(this.newSeed()), userIds: [userId] }).catch(() => []);
    if (sample.length === 0) return { ok: false, error: 'NO_QUESTIONS' };
    // Re-check after the awaits: another join of the same player may have landed.
    if (this.byUser.has(userId) || this.waiting.has(userId)) return { ok: false, error: 'ALREADY_QUEUED' };
    this.dropRecent(userId);
    this.waiting.set(userId, { since: this.now(), topicId: topicId ?? null, mix, poolKey: key });
    void this.tryPair(userId);
    return { ok: true };
  }

  /** Leaves the line; true when the player was in it. */
  leaveQueue(userId: string): boolean {
    return this.waiting.delete(userId);
  }

  /** Leaving a line, or a running game (which the rival then wins). */
  leave(userId: string): { ok: true } | { ok: false; error: ErrorCode } {
    if (this.waiting.delete(userId)) return { ok: true };
    const e = this.entryOf(userId);
    if (!e) return { ok: false, error: 'NOT_IN_MATCH' };
    // Like a board duel: the leaver forfeits the fee and the leave is logged for the penalty (day ban, badge). A bot never leaves.
    if (!this.deps.isBot?.(userId)) {
      try {
        this.deps.onLeave?.({ userId, matchId: e.id });
      } catch {
        /* the penalty log must not break leaving */
      }
    }
    void this.finish(e, 'forfeit', e.players[0] === userId ? 1 : 0);
    return { ok: true };
  }

  private async tryPair(userId: string): Promise<void> {
    const me = this.waiting.get(userId);
    if (!me) return;
    for (const [otherId, o] of this.waiting) {
      if (otherId === userId || o.poolKey !== me.poolKey) continue;
      // A mix search meets only another mix search (the stakes are higher); a topic player meets the same topic or a random one; two different topics do not meet.
      if (me.mix !== o.mix) continue;
      if (me.topicId !== null && o.topicId !== null && me.topicId !== o.topicId) continue;
      const topicId = me.topicId ?? o.topicId;
      this.waiting.delete(userId);
      this.waiting.delete(otherId);
      // The longer waiter sits on side 0.
      const [a, b] = o.since <= me.since ? ([otherId, userId] as const) : ([userId, otherId] as const);
      const out = await this.start(a, b, topicId ?? undefined, me.mix);
      if (out !== 'ok') {
        const broke = typeof out === 'object' ? out.broke : null;
        if (broke) this.refuse(broke, 'INSUFFICIENT_COINS');
        if (broke !== userId && !this.byUser.has(userId) && !this.waiting.has(userId)) this.waiting.set(userId, me);
        if (broke !== otherId && !this.byUser.has(otherId) && !this.waiting.has(otherId)) this.waiting.set(otherId, o);
      }
      return;
    }
  }

  /** The bot driver gives a waiting human a bot opponent after the usual wait; false when the game could not start (they stay in line). */
  async startWithBot(userId: string, botId: string): Promise<boolean> {
    const me = this.waiting.get(userId);
    if (!me || this.byUser.has(botId)) return false;
    this.waiting.delete(userId);
    const out = await this.start(userId, botId, me.topicId ?? undefined, me.mix);
    if (typeof out === 'object') this.refuse(out.broke, 'INSUFFICIENT_COINS'); // the human cannot pay: they leave the line
    else if (out === 'fail' && !this.byUser.has(userId) && !this.waiting.has(userId)) this.waiting.set(userId, me);
    return out === 'ok';
  }

  /** A search or rematch ended without a game for this player; the app shows why. */
  private refuse(userId: string, error: ErrorCode): void {
    this.deps.emit(userId, ServerEvent.tduelRefused, { error });
  }

  private async start(a: string, b: string, topicId?: string, mix = false): Promise<StartResult> {
    try {
      if (a === b || this.byUser.has(a) || this.byUser.has(b)) return 'fail';
      const [pa, pb, pool, settings] = await Promise.all([this.deps.profile(a), this.deps.profile(b), this.poolKey(a), this.deps.settings()]);
      if (!pa || !pb) return 'fail';
      const rng = mulberry32(this.newSeed());
      const questions = await this.deps.questions({ topicId, tracks: pool.tracks, count: Math.max(1, settings.questions), rng, userIds: [a, b].filter((u) => !this.deps.isBot?.(u)) });
      if (questions.length === 0) return 'fail';
      const topicNameFa = topicId ? ((await this.deps.topicName(topicId).catch(() => null)) ?? null) : null;
      if (this.byUser.has(a) || this.byUser.has(b)) return 'fail'; // raced with another start while loading
      const id = uuidv7();
      let stakes: [Stake, Stake] | undefined;
      let fee = 0;
      if (this.deps.stakes) {
        const taken = await this.deps.stakes.openDuel(id, [a, b], mix);
        if (!taken.ok) return { broke: taken.broke };
        stakes = taken.stakes;
        fee = taken.fee;
        if (this.byUser.has(a) || this.byUser.has(b)) {
          await this.deps.stakes.cancelDuel(id, [a, b], stakes, fee);
          return 'fail';
        }
      }
      const players: TduelFound['players'] = [{ userId: a, side: 0, ...pa }, { userId: b, side: 1, ...pb }];
      const entry: Active = {
        id,
        players: [a, b],
        state: startTriviaRound(questions),
        endsAt: 0,
        seconds: Math.max(1, settings.seconds),
        ready: false,
        cancel: null,
        topicNameFa,
        topicId,
        mix,
        stakes,
        fee,
        found: [
          { matchId: id, you: 0, youId: a, topicNameFa, fee: stakes?.[0] === 'paid' ? fee : 0, players },
          { matchId: id, you: 1, youId: b, topicNameFa, fee: stakes?.[1] === 'paid' ? fee : 0, players },
        ],
      };
      this.matches.set(id, entry);
      this.byUser.set(a, id);
      this.byUser.set(b, id);
      this.deps.emit(a, ServerEvent.tduelFound, entry.found[0]);
      this.deps.emit(b, ServerEvent.tduelFound, entry.found[1]);
      const intro = this.deps.introMs ?? TRIVIA_DUEL_INTRO_MS;
      if (intro > 0) {
        entry.cancel = this.schedule(intro, () => this.open(entry));
      } else {
        this.open(entry);
      }
      return 'ok';
    } catch (e) {
      console.error('[tduel] could not start', e);
      return 'fail';
    }
  }

  /** The versus card is over: the first question opens and its clock starts. */
  private open(entry: Active): void {
    if (!this.matches.has(entry.id)) return;
    entry.ready = true;
    this.arm(entry);
    this.push(entry);
  }

  private arm(entry: Active): void {
    entry.cancel?.();
    entry.endsAt = this.now() + entry.seconds * 1000;
    const index = entry.state.index;
    entry.cancel = this.schedule(entry.seconds * 1000, () => {
      if (!this.matches.has(entry.id) || entry.state.index !== index) return;
      this.apply(entry, { type: 'timeout' });
    });
  }

  private view(entry: Active, side: 0 | 1): TduelState {
    return { matchId: entry.id, you: side, status: entry.state.status, round: toTriviaRoundView(entry.state, side === 0 ? 'a' : 'b', entry.endsAt) };
  }

  private push(entry: Active): void {
    for (const side of [0, 1] as const) this.deps.emit(entry.players[side], ServerEvent.tduelState, this.view(entry, side));
  }

  /** A hidden answer. Idempotent: a second answer to the same question is ignored. */
  answer(userId: string, index: number): { ok: true } | { ok: false; error: ErrorCode } {
    const entry = this.entryOf(userId);
    if (!entry) return { ok: false, error: 'NOT_IN_MATCH' };
    if (!entry.ready || entry.state.status !== 'playing') return { ok: false, error: 'NO_TRIVIA_ROUND' };
    this.apply(entry, { type: 'answer', side: entry.players[0] === userId ? 'a' : 'b', index });
    return { ok: true };
  }

  private apply(entry: Active, cmd: Parameters<typeof applyTriviaCommand>[1]): void {
    const before = entry.state;
    const next = applyTriviaCommand(before, cmd);
    if (next === before) return;
    entry.state = next;
    // A newly revealed question has been seen by both humans (the memory that keeps questions from repeating).
    if (next.revealed.length > before.revealed.length) {
      const shown = next.questions[next.revealed[next.revealed.length - 1]!.index]?.id;
      if (shown) {
        try {
          this.deps.markSeen?.(entry.players.filter((u) => !this.deps.isBot?.(u)), shown);
          const done = next.revealed[next.revealed.length - 1]!;
          const humans = ([0, 1] as const).filter((s) => !this.deps.isBot?.(entry.players[s]));
          const picks = humans.map((s) => (s === 0 ? done.picks.a : done.picks.b)).filter((p): p is number => p !== null);
          this.deps.onRevealed?.({ questionId: shown, answers: picks.length, right: picks.filter((p) => p === done.correctIndex).length });
        } catch {
          /* the memory must never break a game */
        }
      }
    }
    if (next.index === before.index && next.status === 'playing') return this.push(entry); // an answer locked in, nothing revealed yet
    if (next.status === 'finished') {
      entry.cancel?.();
      entry.cancel = null;
      return void this.finish(entry, 'played');
    }
    this.arm(entry);
    this.push(entry);
  }

  private async finish(entry: Active, reason: 'played' | 'forfeit', forced?: 0 | 1): Promise<void> {
    if (!this.matches.has(entry.id)) return;
    entry.cancel?.();
    entry.cancel = null;
    this.matches.delete(entry.id);
    for (const u of entry.players) this.byUser.delete(u);
    const scores = triviaPoints(entry.state);
    const winner = forced ?? triviaWinner(scores);
    let coins: [number, number] = [0, 0];
    if (entry.stakes && this.deps.stakes) {
      try {
        coins = await this.deps.stakes.settleDuel(entry.id, entry.players, entry.stakes, entry.fee, { winner, reason: reason === 'played' ? 'solved' : 'forfeit' });
      } catch (e) {
        console.error('[tduel] settle failed', entry.id, e);
      }
    }
    // A played game may be rematched by either side for a while; a forfeit ends it for good.
    const canRematch = reason === 'played';
    if (canRematch) this.openRematch(entry);
    for (const side of [0, 1] as const) {
      const ended: TduelEnded = { matchId: entry.id, winner, reason, scores, coins: coins[side], canRematch, round: toTriviaRoundView(entry.state, side === 0 ? 'a' : 'b', entry.endsAt) };
      this.deps.emit(entry.players[side], ServerEvent.tduelEnded, ended);
    }
    try {
      this.deps.onEnded?.({ matchId: entry.id, players: [entry.players[0], entry.players[1]], winner, reason });
    } catch {
      /* a notification hook must never break the game flow */
    }
  }

  private openRematch(entry: Active): void {
    const seconds = this.deps.rematchSeconds ?? TRIVIA_DUEL_REMATCH_SECONDS;
    const r: Recent = { players: [entry.players[0], entry.players[1]], topicId: entry.topicId, mix: entry.mix, asked: new Set(), cancel: () => undefined };
    r.cancel = this.schedule(seconds * 1000, () => {
      for (const u of r.players) {
        if (this.recent.get(u) !== r) continue;
        this.recent.delete(u);
        if (!this.deps.isBot?.(u)) this.deps.emit(u, ServerEvent.tduelOffer, { state: 'expired' });
      }
    });
    for (const u of r.players) this.recent.set(u, r);
  }

  /** The player starts something else (or leaves): their open rematch chance goes, and the rival is told. */
  private dropRecent(userId: string): void {
    const r = this.recent.get(userId);
    if (!r) return;
    r.cancel();
    for (const u of r.players) {
      this.recent.delete(u);
      if (u !== userId && !this.deps.isBot?.(u)) this.deps.emit(u, ServerEvent.tduelOffer, { state: 'expired' });
    }
  }

  /**
   * Asks the finished game's rival for another one (same topic, fee paid again). A bot, or a rival who already asked, starts it at once;
   * otherwise the rival hears `tduel:offer {asked}` and the ask waits for their answer until the rematch window closes.
   */
  async rematch(userId: string): Promise<{ ok: true } | { ok: false; error: ErrorCode }> {
    const r = this.recent.get(userId);
    if (!r) return { ok: false, error: 'UNKNOWN_MATCH' };
    if (this.byUser.has(userId) || this.waiting.has(userId) || this.deps.busy?.(userId)) return { ok: false, error: 'ALREADY_IN_MATCH' };
    if (this.deps.stakes && !(await this.deps.stakes.canAffordDuel(userId, r.mix))) return { ok: false, error: 'INSUFFICIENT_COINS' };
    if (this.recent.get(userId) !== r) return { ok: false, error: 'UNKNOWN_MATCH' };
    const rival = r.players[0] === userId ? r.players[1] : r.players[0];
    if (!this.deps.isBot?.(rival) && !r.asked.has(rival)) {
      r.asked.add(userId);
      this.deps.emit(rival, ServerEvent.tduelOffer, { state: 'asked' });
      return { ok: true };
    }
    // Both want it: the chance is used up, the game starts (the longer-waiting side order is kept).
    r.cancel();
    for (const u of r.players) this.recent.delete(u);
    if (this.deps.busy?.(rival)) {
      this.deps.emit(userId, ServerEvent.tduelOffer, { state: 'expired' });
      return { ok: false, error: 'ALREADY_IN_MATCH' };
    }
    const out = await this.start(r.players[0], r.players[1], r.topicId, r.mix);
    if (out === 'ok') return { ok: true };
    if (typeof out === 'object') {
      this.refuse(out.broke, 'INSUFFICIENT_COINS');
      if (out.broke !== userId) this.deps.emit(userId, ServerEvent.tduelOffer, { state: 'expired' });
      return out.broke === userId ? { ok: false, error: 'INSUFFICIENT_COINS' } : { ok: true };
    }
    this.deps.emit(rival, ServerEvent.tduelOffer, { state: 'expired' });
    return { ok: false, error: 'INTERNAL' };
  }

  /** A returning player gets the game's snapshot again (and its found card). False when not in a game. */
  resume(userId: string): boolean {
    const entry = this.entryOf(userId);
    if (!entry) return false;
    const side = entry.players[0] === userId ? 0 : 1;
    this.deps.emit(userId, ServerEvent.tduelFound, entry.found[side]);
    if (entry.ready) this.deps.emit(userId, ServerEvent.tduelState, this.view(entry, side));
    return true;
  }

  /** INTERNAL, for the bot driver only: the right choice of the question a bot has not answered yet. Never sent to any client. */
  answerFor(userId: string): number | null {
    const entry = this.entryOf(userId);
    if (!entry || !entry.ready || entry.state.status !== 'playing') return null;
    const side = entry.players[0] === userId ? 'a' : 'b';
    if (entry.state.answered[side]) return null;
    return entry.state.questions[entry.state.index]?.correctIndex ?? null;
  }
}
