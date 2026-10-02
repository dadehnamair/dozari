import { randomInt } from 'node:crypto';
import { applyCommand, matchClientView, mulberry32, ServerEvent, startMatch, startTeamMatch, turnDeadline } from '@dozari/shared';
import type { Command, ErrorCode, Stake, MatchEnded, MatchEvent, MatchFound, MatchState, MatchView, Rng, RuleError } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';
import type { PuzzleSource, ServedPuzzle } from '../solo/types.js';

export interface PlayerProfile {
  nickname: string;
  avatarKey: string;
  level: number;
  coins: number;
}

export interface MatchDeps {
  puzzles: PuzzleSource;
  /** Public facts about a player for the opponent's card; null = unknown user (match is not created). */
  profile(userId: string): Promise<PlayerProfile | null>;
  /** Pushes a server event to every open socket of a user. */
  emit(userId: string, event: string, payload: unknown): void;
  now?: () => number;
  newSeed?: () => number;
  /** Schedules `fn` after `ms`; returns the canceller. Injected so tests can drive the clock. */
  schedule?: (ms: number, fn: () => void) => () => void;
  /** Called once when a match ends, with the two players' ids by side (e.g. to send results to Bale). */
  /** Coin stakes of queue duels. Absent = everything is friendly. */
  stakes?: {
    open(matchId: string, players: readonly [string, string]): Promise<[Stake, Stake] | null>;
    /** The match never started: give every taken fee back in full. */
    cancel(matchId: string, players: readonly [string, string], stakes: readonly [Stake, Stake]): Promise<void>;
    settle(matchId: string, players: readonly [string, string], stakes: readonly [Stake, Stake], result: { winner: 0 | 1 | null; reason: 'solved' | 'locked_out' | 'forfeit' | 'abandon' }): Promise<void>;
  };
  onEnded?: (info: { players: readonly [string, string]; result: NonNullable<MatchState['result']> }) => void;
}

interface Active {
  id: string;
  state: MatchState;
  puzzle: ServedPuzzle;
  cancel: (() => void) | null;
  /** How each seat entered, when the match carried coin stakes. */
  stakes?: [Stake, Stake];
  /** Latest proposal per side (2v2); only that side's own players ever see it. */
  proposals: [{ by: string; itemIds: readonly string[] } | null, { by: string; itemIds: readonly string[] } | null];
}

const RULE_TO_ERROR: Record<RuleError, ErrorCode> = {
  MATCH_FINISHED: 'MATCH_FINISHED',
  UNKNOWN_PLAYER: 'NOT_IN_MATCH',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  NOT_CAPTAIN: 'NOT_CAPTAIN',
  NOT_TEAM_MATCH: 'NOT_TEAM_MATCH',
  INVALID_SELECTION: 'INVALID_SELECTION',
  DUPLICATE_SELECTION: 'DUPLICATE_SELECTION',
};

const defaultSchedule = (ms: number, fn: () => void) => {
  const t = setTimeout(fn, ms);
  return () => clearTimeout(t);
};

/**
 * Live 1v1 matches around the shared reducer (docs/logic/matchmaking.md). In memory, server authoritative; the turn
 * clock is a timer that sends the reducer a `timeout` for the turn it was set for. Not built yet: entry-fee escrow and
 * payouts, the price-guess round, the ready handshake, reconnect grace and bot takeover. Until then an AFK player
 * is ended by the reducer's consecutive-timeout rule.
 */
export class MatchService {
  private readonly matches = new Map<string, Active>();
  private readonly byUser = new Map<string, string>();
  private readonly now: () => number;
  private readonly newSeed: () => number;
  private readonly schedule: (ms: number, fn: () => void) => () => void;

  constructor(private readonly deps: MatchDeps) {
    this.now = deps.now ?? Date.now;
    this.newSeed = deps.newSeed ?? (() => randomInt(0, 2 ** 31));
    this.schedule = deps.schedule ?? defaultSchedule;
  }

  get activeCount(): number {
    return this.matches.size;
  }

  /** The match a player is in and who the opponent is (for canned taunts), or null. */
  opponentOf(userId: string): { matchId: string; opponentId: string } | null {
    const id = this.byUser.get(userId);
    const entry = id ? this.matches.get(id) : undefined;
    if (!id || !entry) return null;
    const mine = entry.state.players.find((p) => p.userId === userId);
    const other = entry.state.players.find((p) => p.side !== mine?.side && !entry.state.gone.includes(p.userId));
    return other ? { matchId: id, opponentId: other.userId } : null;
  }

  /**
   * INTERNAL, for the bot driver only: the groups not solved yet and the cards left, for a player of a live match. Nothing here may ever be
   * sent to a client; bots play inside the server and move through `submit` like humans (docs/logic/bots.md).
   */
  solutionFor(userId: string): { groups: string[][]; remaining: string[]; tried: readonly string[] } | null {
    const entry = this.entryOf(userId);
    if (!entry || entry.state.status !== 'playing') return null;
    const done = new Set(entry.state.solved.map((g) => g.level));
    return { groups: entry.state.puzzle.groups.filter((g) => !done.has(g.level)).map((g) => [...g.productIds]), remaining: [...entry.state.remaining], tried: entry.state.tried };
  }

  inMatch(userId: string): boolean {
    return this.byUser.has(userId);
  }

  /** Starts a match for a paired couple; false when it could not be created (no puzzle, unknown or busy player). */
  async start(a: string, b: string, opts: { friendly?: boolean } = {}): Promise<boolean> {
    if (a === b || this.inMatch(a) || this.inMatch(b)) return false;
    const [pa, pb, puzzle] = await Promise.all([this.deps.profile(a), this.deps.profile(b), this.deps.puzzles.pickRandom()]);
    if (!pa || !pb || !puzzle) return false;
    if (this.inMatch(a) || this.inMatch(b)) return false; // raced with another start while loading
    const rng: Rng = mulberry32(this.newSeed());
    const id = uuidv7();
    let stakes: [Stake, Stake] | undefined;
    if (this.deps.stakes && !opts.friendly) {
      const taken = await this.deps.stakes.open(id, [a, b]);
      if (!taken) return false;
      stakes = taken;
      if (this.inMatch(a) || this.inMatch(b)) {
        // Raced with another start while the stakes were taken: give them back in full.
        await this.deps.stakes.cancel(id, [a, b], taken);
        return false;
      }
    }
    const entry: Active = { id, puzzle, state: startMatch(puzzle, [a, b], rng, this.now()), cancel: null, stakes, proposals: [null, null] };
    this.matches.set(id, entry);
    this.byUser.set(a, id);
    this.byUser.set(b, id);
    const profiles: MatchFound['players'] = [{ userId: a, side: 0, ...pa }, { userId: b, side: 1, ...pb }];
    for (const [userId, you] of [[a, 0], [b, 1]] as const) {
      const found: MatchFound = { matchId: id, you, players: profiles };
      this.deps.emit(userId, ServerEvent.matchFound, found);
    }
    this.pushState(entry);
    this.armTimer(entry);
    return true;
  }

  /** Starts a 2v2 for four players (`sides[s]` = side s); no coin stakes yet. False when it could not be created. */
  async startTeam(sides: readonly [readonly [string, string], readonly [string, string]]): Promise<boolean> {
    const all = [...sides[0], ...sides[1]];
    if (new Set(all).size !== 4 || all.some((u) => this.inMatch(u))) return false;
    const [profiles, puzzle] = await Promise.all([Promise.all(all.map((u) => this.deps.profile(u))), this.deps.puzzles.pickRandom()]);
    if (!puzzle || profiles.some((p) => !p)) return false;
    if (all.some((u) => this.inMatch(u))) return false; // raced with another start while loading
    const id = uuidv7();
    const entry: Active = { id, puzzle, state: startTeamMatch(puzzle, sides, mulberry32(this.newSeed()), this.now()), cancel: null, proposals: [null, null] };
    this.matches.set(id, entry);
    for (const u of all) this.byUser.set(u, id);
    const players: MatchFound['players'] = all.map((u, i) => ({ userId: u, side: i < 2 ? 0 : 1, ...(profiles[i] as PlayerProfile) }));
    for (const [i, u] of all.entries()) this.deps.emit(u, ServerEvent.matchFound, { matchId: id, you: i < 2 ? 0 : 1, players } satisfies MatchFound);
    this.pushState(entry);
    this.armTimer(entry);
    return true;
  }

  /** A teammate shows the captain a selection (2v2). Not stored in the match; only the proposer's team sees it. */
  propose(userId: string, itemIds: readonly string[]): { ok: true } | { ok: false; error: ErrorCode } {
    const entry = this.entryOf(userId);
    if (!entry) return { ok: false, error: 'NOT_IN_MATCH' };
    return this.apply(entry, { t: 'propose', by: userId, itemIds });
  }

  submit(userId: string, itemIds: readonly string[]): { ok: true } | { ok: false; error: ErrorCode } {
    const entry = this.entryOf(userId);
    if (!entry) return { ok: false, error: 'NOT_IN_MATCH' };
    return this.apply(entry, { t: 'submit', by: userId, itemIds });
  }

  leave(userId: string): { ok: true } | { ok: false; error: ErrorCode } {
    const entry = this.entryOf(userId);
    if (!entry) return { ok: false, error: 'NOT_IN_MATCH' };
    const out = this.apply(entry, { t: 'leave', by: userId });
    // A teammate who leaves a running 2v2 is free to queue again; the match carries on without them.
    if (out.ok && entry.state.status === 'playing') this.byUser.delete(userId);
    return out;
  }

  /** Re-sends the current snapshot to a returning player. */
  resume(userId: string, matchId?: string): { ok: true } | { ok: false; error: ErrorCode } {
    const entry = this.entryOf(userId);
    if (!entry || (matchId && entry.id !== matchId)) return { ok: false, error: matchId ? 'UNKNOWN_MATCH' : 'NOT_IN_MATCH' };
    this.deps.emit(userId, ServerEvent.matchState, this.view(entry, userId));
    return { ok: true };
  }

  private entryOf(userId: string): Active | undefined {
    const id = this.byUser.get(userId);
    return id ? this.matches.get(id) : undefined;
  }

  private apply(entry: Active, cmd: Command): { ok: true } | { ok: false; error: ErrorCode } {
    const r = applyCommand(entry.state, cmd, { now: this.now() });
    if ('error' in r) return { ok: false, error: RULE_TO_ERROR[r.error] };
    entry.state = r.state;
    for (const e of r.events) {
      if (e.t === 'proposal') entry.proposals[e.side] = e.itemIds.length > 0 ? { by: e.by, itemIds: e.itemIds } : null;
      if (e.t === 'turn') entry.proposals = [null, null];
    }
    this.broadcast(entry, r.events);
    return { ok: true };
  }

  /** One timer per match, always for the current turn; a stale fire is ignored by the reducer (`turnId`). */
  private armTimer(entry: Active) {
    entry.cancel?.();
    entry.cancel = null;
    if (entry.state.status !== 'playing') return;
    const turnId = entry.state.turnId;
    entry.cancel = this.schedule(Math.max(0, turnDeadline(entry.state) - this.now()), () => {
      if (!this.matches.has(entry.id)) return;
      this.apply(entry, { t: 'timeout', turnId });
    });
  }

  private view(entry: Active, userId: string): MatchView {
    const v = matchClientView(entry.state, userId);
    if (!v) throw new Error('not a participant');
    const info = entry.puzzle.items;
    const text = new Map(entry.puzzle.groups.map((g) => [g.level, g]));
    return {
      matchId: entry.id,
      you: v.you,
      youId: userId,
      team: entry.state.players.length > 2,
      cards: v.cards.map((id) => ({ id, nameFa: info[id]?.nameFa ?? id, unitFa: info[id]?.unitFa ?? null, iconKey: info[id]?.iconKey ?? null })),
      solved: v.solved.map((g) => ({ level: g.level, titleFa: text.get(g.level)?.titleFa ?? '', explanationFa: text.get(g.level)?.explanationFa ?? '', productIds: [...g.productIds], by: g.by })),
      scores: [v.scores[0], v.scores[1]],
      mistakes: [v.mistakes[0], v.mistakes[1]],
      lockedOut: [v.lockedOut[0], v.lockedOut[1]],
      turn: v.turn,
      captain: [v.captain[0], v.captain[1]],
      proposal: entry.proposals[v.you] ? { by: entry.proposals[v.you]!.by, itemIds: [...entry.proposals[v.you]!.itemIds] } : null,
      turnId: v.turnId,
      turnEndsAt: v.turnEndsAt,
      status: v.status,
      result: v.result,
    };
  }

  private pushState(entry: Active) {
    for (const p of entry.state.players) this.deps.emit(p.userId, ServerEvent.matchState, this.view(entry, p.userId));
  }

  private broadcast(entry: Active, events: readonly MatchEvent[]) {
    this.pushState(entry);
    for (const p of entry.state.players) for (const e of events) if (e.t !== 'proposal') this.deps.emit(p.userId, ServerEvent.matchEvent, e);
    if (entry.state.status === 'finished') {
      this.finish(entry);
    } else {
      this.armTimer(entry);
    }
  }

  private finish(entry: Active) {
    entry.cancel?.();
    entry.cancel = null;
    const result = entry.state.result;
    if (result) {
      const ended: MatchEnded = {
        matchId: entry.id,
        result,
        scores: [entry.state.scores[0], entry.state.scores[1]],
        groups: [...entry.puzzle.groups]
          .sort((a, b) => a.level - b.level)
          .map((g) => ({ level: g.level, titleFa: g.titleFa, explanationFa: g.explanationFa, productIds: [...g.productIds] })) as MatchEnded['groups'],
      };
      for (const p of entry.state.players) this.deps.emit(p.userId, ServerEvent.matchEnded, ended);
    }
    const duel = entry.state.players.length === 2;
    if (result && duel) {
      try {
        this.deps.onEnded?.({ players: [entry.state.players[0]!.userId, entry.state.players[1]!.userId], result });
      } catch {
        /* a notification hook must never break the match flow */
      }
    }
    if (result && entry.stakes && this.deps.stakes) {
      const players: [string, string] = [entry.state.players[0]!.userId, entry.state.players[1]!.userId];
      void this.deps.stakes.settle(entry.id, players, entry.stakes, { winner: result.winner, reason: result.reason }).catch((e) => console.error('[duel] settle failed', entry.id, e));
    }
    for (const p of entry.state.players) this.byUser.delete(p.userId);
    this.matches.delete(entry.id);
  }
}
