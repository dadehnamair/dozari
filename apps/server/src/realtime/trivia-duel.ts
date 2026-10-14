import { randomInt } from 'node:crypto';
import { ServerEvent, TRIVIA_DUEL_INTRO_MS, applyTriviaCommand, mulberry32, startTriviaRound, toTriviaRoundView, triviaPoints, triviaWinner } from '@dozari/shared';
import type { AgeTrack, ErrorCode, Rng, TduelEnded, TduelFound, TduelState, TriviaRoundQuestion, TriviaRoundState } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';
import type { PlayerProfile } from './match-service.js';

export interface TriviaDuelDeps {
  emit(userId: string, event: string, payload: unknown): void;
  profile(userId: string): Promise<PlayerProfile | null>;
  /** The question pools a player may draw from (their age track). Players are only paired when theirs are the same. Absent = adult. */
  poolOf?: (userId: string) => Promise<readonly AgeTrack[]>;
  /** Questions for one game, choices already shuffled; `topicId` absent = a mix of the whole bank. [] = nothing to ask. */
  questions(o: { topicId?: string; tracks: readonly AgeTrack[]; count: number; rng: Rng }): Promise<TriviaRoundQuestion[]>;
  topicName(topicId: string): Promise<string | null>;
  settings(): Promise<{ questions: number; seconds: number }>;
  /** A non-null answer refuses the join (maintenance, feature switched off, the player's age track). */
  gate?: (userId: string) => Promise<ErrorCode | null>;
  /** True when the player is already in a board duel or its queue. */
  busy?: (userId: string) => boolean;
  /** A game ended with a winner or a draw (bots included); must not throw. */
  onEnded?: (r: { players: [string, string]; winner: 0 | 1 | null; reason: 'played' | 'forfeit' }) => void;
  /** How long the versus card shows before the first question opens; absent = the shared default, 0 = open at once. */
  introMs?: number;
  now?: () => number;
  newSeed?: () => number;
  schedule?: (ms: number, fn: () => void) => () => void;
}

interface Waiting {
  since: number;
  topicId: string | null;
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
  found: [TduelFound, TduelFound];
}

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
  async join(userId: string, topicId?: string): Promise<{ ok: true } | { ok: false; error: ErrorCode }> {
    const refused = await this.deps.gate?.(userId);
    if (refused) return { ok: false, error: refused };
    if (this.byUser.has(userId) || this.deps.busy?.(userId)) return { ok: false, error: 'ALREADY_IN_MATCH' };
    if (this.waiting.has(userId)) return { ok: false, error: 'ALREADY_QUEUED' };
    const { tracks, key } = await this.poolKey(userId);
    // A topic with nothing to ask must be told at once, not left to search forever.
    const sample = await this.deps.questions({ topicId, tracks, count: 1, rng: mulberry32(this.newSeed()) }).catch(() => []);
    if (sample.length === 0) return { ok: false, error: 'NO_QUESTIONS' };
    // Re-check after the awaits: another join of the same player may have landed.
    if (this.byUser.has(userId) || this.waiting.has(userId)) return { ok: false, error: 'ALREADY_QUEUED' };
    this.waiting.set(userId, { since: this.now(), topicId: topicId ?? null, poolKey: key });
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
    this.finish(e, 'forfeit', e.players[0] === userId ? 1 : 0);
    return { ok: true };
  }

  private async tryPair(userId: string): Promise<void> {
    const me = this.waiting.get(userId);
    if (!me) return;
    for (const [otherId, o] of this.waiting) {
      if (otherId === userId || o.poolKey !== me.poolKey) continue;
      // A topic player meets the same topic or a random one; two different topics do not meet.
      if (me.topicId !== null && o.topicId !== null && me.topicId !== o.topicId) continue;
      const topicId = me.topicId ?? o.topicId;
      this.waiting.delete(userId);
      this.waiting.delete(otherId);
      // The longer waiter sits on side 0.
      const [a, b] = o.since <= me.since ? ([otherId, userId] as const) : ([userId, otherId] as const);
      const ok = await this.start(a, b, topicId ?? undefined);
      if (!ok) {
        if (!this.byUser.has(userId) && !this.waiting.has(userId)) this.waiting.set(userId, me);
        if (!this.byUser.has(otherId) && !this.waiting.has(otherId)) this.waiting.set(otherId, o);
      }
      return;
    }
  }

  /** The bot driver gives a waiting human a bot opponent after the usual wait; false when the game could not start (they stay in line). */
  async startWithBot(userId: string, botId: string): Promise<boolean> {
    const me = this.waiting.get(userId);
    if (!me || this.byUser.has(botId)) return false;
    this.waiting.delete(userId);
    const ok = await this.start(userId, botId, me.topicId ?? undefined);
    if (!ok && !this.byUser.has(userId) && !this.waiting.has(userId)) this.waiting.set(userId, me);
    return ok;
  }

  private async start(a: string, b: string, topicId?: string): Promise<boolean> {
    try {
      if (a === b || this.byUser.has(a) || this.byUser.has(b)) return false;
      const [pa, pb, pool, settings] = await Promise.all([this.deps.profile(a), this.deps.profile(b), this.poolKey(a), this.deps.settings()]);
      if (!pa || !pb) return false;
      const rng = mulberry32(this.newSeed());
      const questions = await this.deps.questions({ topicId, tracks: pool.tracks, count: Math.max(1, settings.questions), rng });
      if (questions.length === 0) return false;
      const topicNameFa = topicId ? ((await this.deps.topicName(topicId).catch(() => null)) ?? null) : null;
      if (this.byUser.has(a) || this.byUser.has(b)) return false; // raced with another start while loading
      const id = uuidv7();
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
        found: [
          { matchId: id, you: 0, youId: a, topicNameFa, players },
          { matchId: id, you: 1, youId: b, topicNameFa, players },
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
      return true;
    } catch (e) {
      console.error('[tduel] could not start', e);
      return false;
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
    if (next.index === before.index && next.status === 'playing') return this.push(entry); // an answer locked in, nothing revealed yet
    if (next.status === 'finished') {
      entry.cancel?.();
      entry.cancel = null;
      return this.finish(entry, 'played');
    }
    this.arm(entry);
    this.push(entry);
  }

  private finish(entry: Active, reason: 'played' | 'forfeit', forced?: 0 | 1): void {
    if (!this.matches.has(entry.id)) return;
    entry.cancel?.();
    entry.cancel = null;
    this.matches.delete(entry.id);
    for (const u of entry.players) this.byUser.delete(u);
    const scores = triviaPoints(entry.state);
    const winner = forced ?? triviaWinner(scores);
    for (const side of [0, 1] as const) {
      const ended: TduelEnded = { matchId: entry.id, winner, reason, scores, round: toTriviaRoundView(entry.state, side === 0 ? 'a' : 'b', entry.endsAt) };
      this.deps.emit(entry.players[side], ServerEvent.tduelEnded, ended);
    }
    try {
      this.deps.onEnded?.({ players: [entry.players[0], entry.players[1]], winner, reason });
    } catch {
      /* a notification hook must never break the game flow */
    }
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
