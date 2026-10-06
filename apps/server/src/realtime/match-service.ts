import { randomInt } from 'node:crypto';
import { DEFAULT_MATCH_RULES, TEAM_MATCH_BOARDS, applyCommand, settleWager, applyPriceGuessCommand, finalScores, matchClientView, mulberry32, resolveWinner, selectRounds, ServerEvent, startMatch, startPriceGuess, startTeamMatch, toPriceRoundView, trackRules, turnDeadline } from '@dozari/shared';
import type { AgeTrack, CatalogProduct, Command, RevealedRound, WagerSeat, ErrorCode, PriceGuessState, Stake, MatchEnded, MatchRules, MatchEvent, MatchEventPayload, MatchFound, MatchState, MatchView, Rng, RuleError } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';
import type { PuzzleSource, ServedPuzzle } from '../solo/types.js';
import { pickUnseen } from '../solo/history.js';
import type { PuzzleHistory } from '../solo/history.js';

export interface PlayerProfile {
  nickname: string;
  avatarKey: string;
  level: number;
  coins: number;
  /** In their birthday week: a party chip on the name tag for everybody (never the date or age). */
  birthday?: boolean;
}

export interface MatchDeps {
  puzzles: PuzzleSource;
  /** Puzzles each player has already had: a duel, table or 2v2 never serves one of them again (until the pool runs dry). */
  history?: PuzzleHistory;
  /** A player's age track (D198); queues pair one track, so the first player's track picks the puzzle pool. Absent = adult. */
  trackOf?: (userId: string) => Promise<AgeTrack>;
  /** May this player put coins on a match (`trackRules(track).coinWager`)? A kid or teen never does: such a match is friendly. Absent = everybody may. */
  wagerAllowed?: (userId: string) => Promise<boolean>;
  /** Public facts about a player for the opponent's card; null = unknown user (match is not created). */
  profile(userId: string): Promise<PlayerProfile | null>;
  /** Pushes a server event to every open socket of a user. */
  emit(userId: string, event: string, payload: unknown): void;
  /** Boards of a 2v2 match (admin setting `match.team_boards`); absent = the shared default. */
  teamBoards?: () => Promise<number>;
  /** The match numbers (admin settings turn / mistakes / scoring), read when a match starts; absent or failing = the shared defaults. */
  rules?: () => Promise<MatchRules>;
  /** Whether a 1v1 ends with the price-guess round (admin setting `match.price_round`), read when a match starts; absent = no. */
  priceRound?: () => Promise<boolean>;
  now?: () => number;
  newSeed?: () => number;
  /** Schedules `fn` after `ms`; returns the canceller. Injected so tests can drive the clock. */
  schedule?: (ms: number, fn: () => void) => () => void;
  /** Called once when a match ends, with the two players' ids by side (e.g. to send results to Bale). */
  /** Coin stakes of queue duels. Absent = everything is friendly. */
  stakes?: {
    open(matchId: string, players: readonly [string, string], tier?: string): Promise<[Stake, Stake] | null>;
    /** The match never started: give every taken fee back in full. */
    cancel(matchId: string, players: readonly [string, string], stakes: readonly [Stake, Stake], tier?: string): Promise<void>;
    /** Per-round coin wager of the price-guess round, or null for none (see `DuelStakes.wagerRules`). */
    wagerRules?(): Promise<{ amount: number; cutPercent: number; isBot: (userId: string) => boolean } | null>;
    takeWager?(matchId: string, round: number, userId: string, amount: number): Promise<boolean>;
    creditWager?(matchId: string, round: number, userId: string, coins: number): Promise<void>;
    settle(matchId: string, players: readonly [string, string], stakes: readonly [Stake, Stake], result: { winner: 0 | 1 | null; reason: 'solved' | 'locked_out' | 'forfeit' | 'abandon' }, tier?: string): Promise<void>;
  };
  onEnded?: (info: { players: readonly [string, string]; result: NonNullable<MatchState['result']> }) => void;
}

interface Active {
  id: string;
  state: MatchState;
  /** One served puzzle per board; `state.round` says which is in play. */
  puzzles: ServedPuzzle[];
  cancel: (() => void) | null;
  /** How each seat entered, when the match carried coin stakes. */
  stakes?: [Stake, Stake];
  /** Stake table the match was queued at (settles with its fee). */
  tier?: string;
  /** Frozen at the start: this match ends with the price-guess round (1v1 only). */
  priceRound?: boolean;
  /** The board is over and the price rounds are being drawn (the clients must not see a finished match yet). */
  pgPending?: boolean;
  /** The running price-guess phase; `busy` while a round's wagers are being settled or taken (no guesses then). */
  pg?: { state: PriceGuessState; endsAt: number; cancel: (() => void) | null; busy?: boolean };
  /** Per-round coin wager (stake matches only), frozen at the start. */
  wager?: { amount: number; cutPercent: number; isBot: (userId: string) => boolean };
  /** Wagers put down for the round in play and not settled yet. */
  pgRound?: { index: number; seats: [WagerSeat, WagerSeat] };
  /** Who sits where, as sent with `match:found` (a returning player gets it again on resume). */
  players?: MatchFound['players'];
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

const toSolo = (p: ServedPuzzle) => ({ groups: p.groups.map((g) => ({ level: g.level, productIds: g.productIds })) });

const defaultSchedule = (ms: number, fn: () => void) => {
  const t = setTimeout(fn, ms);
  return () => clearTimeout(t);
};

/**
 * Live 1v1 matches around the shared reducer (docs/logic/matchmaking.md). In memory, server authoritative; the turn
 * clock is a timer that sends the reducer a `timeout` for the turn it was set for. A 1v1 may end with the price-guess round (setting
 * `match.price_round`, docs/logic/price-guess-round.md). Not built yet: the ready handshake, reconnect grace and bot takeover. Until then an
 * AFK player is ended by the reducer's consecutive-timeout rule (entry-fee stakes are in `duel/stakes.ts`).
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
  async start(a: string, b: string, opts: { friendly?: boolean; tier?: string } = {}): Promise<boolean> {
    if (a === b || this.inMatch(a) || this.inMatch(b)) return false;
    const [pa, pb] = await Promise.all([this.deps.profile(a), this.deps.profile(b)]);
    if (!pa || !pb) return false;
    // The stronger of the two sets the puzzle tier (docs/logic/progression.md).
    const tracks = await this.tracksOf(a);
    const puzzle = await pickUnseen(this.deps.history, [a, b], [], (exclude) => this.deps.puzzles.pickRandom({ level: Math.max(pa.level, pb.level), tracks, exclude }));
    if (!puzzle) return false;
    if (this.inMatch(a) || this.inMatch(b)) return false; // raced with another start while loading
    const rng: Rng = mulberry32(this.newSeed());
    const id = uuidv7();
    let stakes: [Stake, Stake] | undefined;
    // No wagers for kid and teen (docs/logic/age-tracks.md): if either human may not wager, nobody pays and nobody wins coins.
    const noWager = this.deps.wagerAllowed ? !(await Promise.all([this.deps.wagerAllowed(a), this.deps.wagerAllowed(b)])).every(Boolean) : false;
    if (this.deps.stakes && !opts.friendly && !noWager) {
      const taken = await this.deps.stakes.open(id, [a, b], opts.tier);
      if (!taken) return false;
      stakes = taken;
      if (this.inMatch(a) || this.inMatch(b)) {
        // Raced with another start while the stakes were taken: give them back in full.
        await this.deps.stakes.cancel(id, [a, b], taken, opts.tier);
        return false;
      }
    }
    const entry: Active = { id, puzzles: [puzzle], state: startMatch(puzzle, [a, b], rng, this.now(), undefined, await this.matchRules()), cancel: null, stakes, tier: stakes ? opts.tier : undefined, priceRound: await this.wantsPriceRound(), proposals: [null, null] };
    if (entry.priceRound && stakes) entry.wager = (await this.deps.stakes?.wagerRules?.().catch(() => null)) ?? undefined;
    this.matches.set(id, entry);
    this.byUser.set(a, id);
    this.byUser.set(b, id);
    const profiles: MatchFound['players'] = [{ userId: a, side: 0, ...pa }, { userId: b, side: 1, ...pb }];
    entry.players = profiles;
    for (const [userId, you] of [[a, 0], [b, 1]] as const) {
      const found: MatchFound = { matchId: id, you, youId: userId, players: profiles };
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
    const profiles = await Promise.all(all.map((u) => this.deps.profile(u)));
    if (profiles.some((p) => !p)) return false;
    // The strongest player sets the puzzle tier, so nobody gets dumbed down (docs/logic/progression.md).
    const boards = await this.pickBoards(await this.boardCount(), Math.max(...profiles.map((p) => p!.level)), await this.tracksOf(sides[0][0]), all);
    if (boards.length === 0) return false;
    if (all.some((u) => this.inMatch(u))) return false; // raced with another start while loading
    const id = uuidv7();
    const entry: Active = { id, puzzles: boards, state: startTeamMatch(boards.map(toSolo), sides, mulberry32(this.newSeed()), this.now(), undefined, await this.matchRules()), cancel: null, proposals: [null, null] };
    this.matches.set(id, entry);
    for (const u of all) this.byUser.set(u, id);
    const players: MatchFound['players'] = all.map((u, i) => ({ userId: u, side: i < 2 ? 0 : 1, ...(profiles[i] as PlayerProfile) }));
    entry.players = players;
    for (const [i, u] of all.entries()) this.deps.emit(u, ServerEvent.matchFound, { matchId: id, you: i < 2 ? 0 : 1, youId: u, players } satisfies MatchFound);
    this.pushState(entry);
    this.armTimer(entry);
    return true;
  }

  private async wantsPriceRound(): Promise<boolean> {
    try {
      return (await this.deps.priceRound?.()) ?? false;
    } catch {
      return false;
    }
  }

  private async matchRules(): Promise<MatchRules> {
    try {
      return (await this.deps.rules?.()) ?? DEFAULT_MATCH_RULES;
    } catch {
      return DEFAULT_MATCH_RULES;
    }
  }

  private async boardCount(): Promise<number> {
    try {
      return Math.max(1, (await this.deps.teamBoards?.()) ?? TEAM_MATCH_BOARDS);
    } catch {
      return TEAM_MATCH_BOARDS;
    }
  }

  /** Up to `n` different random puzzles (fewer when the pool is small; at least one or none). */
  /** Puzzle pools for a match: those of this player's track; a failing lookup reads as adult. */
  private async tracksOf(userId: string): Promise<readonly AgeTrack[]> {
    if (!this.deps.trackOf) return ['adult'];
    return trackRules(await this.deps.trackOf(userId).catch(() => 'adult' as const)).puzzleTracks;
  }

  private async pickBoards(n: number, level: number | undefined, tracks: readonly AgeTrack[] | undefined, players: readonly string[]): Promise<ServedPuzzle[]> {
    const out: ServedPuzzle[] = [];
    for (let i = 0; i < n * 3 && out.length < n; i++) {
      // Never the same board twice in one match, and none any of the four has played before.
      const p = await pickUnseen(this.deps.history, players, out.map((o) => o.id), (exclude) => this.deps.puzzles.pickRandom({ level, tracks, exclude }));
      if (!p) break;
      if (!out.some((o) => o.id === p.id)) out.push(p);
    }
    return out;
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
    if (entry.pg || entry.pgPending) {
      // The board is over: leaving the price round just ends the match with the puzzle's result.
      entry.pg?.cancel?.();
      this.finish(entry);
      return { ok: true };
    }
    const out = this.apply(entry, { t: 'leave', by: userId });
    // A teammate who leaves a running 2v2 is free to queue again; the match carries on without them.
    if (out.ok && entry.state.status === 'playing') this.byUser.delete(userId);
    return out;
  }

  /** Re-sends the current snapshot to a returning player. */
  resume(userId: string, matchId?: string): { ok: true } | { ok: false; error: ErrorCode } {
    const entry = this.entryOf(userId);
    if (!entry || (matchId && entry.id !== matchId)) return { ok: false, error: matchId ? 'UNKNOWN_MATCH' : 'NOT_IN_MATCH' };
    // A player who joins the match late (a table started it before their screen opened) learns who plays whom.
    const you = entry.state.players.find((p) => p.userId === userId)?.side;
    if (entry.players && you !== undefined) this.deps.emit(userId, ServerEvent.matchFound, { matchId: entry.id, you, youId: userId, players: entry.players } satisfies MatchFound);
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
    const current = entry.puzzles[entry.state.round] ?? entry.puzzles[0]!;
    const info = current.items;
    const inPrice = !!entry.pg || !!entry.pgPending;
    const text = new Map(current.groups.map((g) => [g.level, g]));
    return {
      matchId: entry.id,
      you: v.you,
      youId: userId,
      team: entry.state.players.length > 2,
      round: v.round,
      rounds: v.rounds,
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
      status: inPrice ? 'playing' : v.status,
      result: inPrice ? null : v.result,
      priceRound: entry.pg ? this.priceViewFor(entry, v.you) : null,
    };
  }

  /** The finished board with its full solution (it is over, so nothing is hidden any more). */
  private boardDone(entry: Active, round: number): MatchEventPayload {
    const done = entry.puzzles[round];
    if (!done) return { t: 'board_done', round };
    return { t: 'board_done', round, groups: [...done.groups].sort((a, b) => a.level - b.level).map((g) => ({ level: g.level, titleFa: g.titleFa, explanationFa: g.explanationFa, productIds: [...g.productIds] })) };
  }

  private pushState(entry: Active) {
    for (const p of entry.state.players) this.deps.emit(p.userId, ServerEvent.matchState, this.view(entry, p.userId));
  }

  private broadcast(entry: Active, events: readonly MatchEvent[]) {
    if (entry.state.status === 'finished' && this.wantsPriceNow(entry)) entry.pgPending = true;
    this.pushState(entry);
    for (const p of entry.state.players) {
      for (const e of events) {
        if (e.t === 'proposal') continue;
        if (e.t === 'finished' && entry.pgPending) continue; // the match is not over for the clients yet
        this.deps.emit(p.userId, ServerEvent.matchEvent, e.t === 'board_done' ? this.boardDone(entry, e.round) : e);
      }
    }
    if (entry.state.status === 'finished') {
      if (entry.pgPending) void this.startPriceRound(entry);
      else this.finish(entry);
    } else {
      this.armTimer(entry);
    }
  }

  /** The duel ends with the price-guess round: a 1v1 whose puzzle was finished by play (not a forfeit), both players still in. */
  private wantsPriceNow(entry: Active): boolean {
    const r = entry.state.result;
    return !!entry.priceRound && entry.state.players.length === 2 && !!r && (r.reason === 'solved' || r.reason === 'locked_out') && entry.state.gone.length === 0;
  }

  private priceViewFor(entry: Active, side: 0 | 1) {
    const info = (entry.puzzles[entry.state.round] ?? entry.puzzles[0]!).items;
    const base = toPriceRoundView(entry.pg!.state, side === 0 ? 'a' : 'b', (id) => ({ nameFa: info[id]?.nameFa ?? id, unitFa: info[id]?.unitFa ?? null, iconKey: info[id]?.iconKey ?? null }), entry.pg!.endsAt);
    return entry.wager ? { ...base, wager: entry.wager.amount, youIn: entry.pgRound ? entry.pgRound.seats[side] !== 'out' : true } : base;
  }

  /** Draws the four rounds from the board that was just played; with none to ask, the match simply ends. */
  private async startPriceRound(entry: Active): Promise<void> {
    try {
      const puzzle = entry.puzzles[entry.state.round] ?? entry.puzzles[0]!;
      const ids = puzzle.groups.flatMap((g) => g.productIds);
      const prices = await this.deps.puzzles.pricesFor(ids);
      const catalog: CatalogProduct[] = ids.map((id) => ({ id, category: '', eraTags: [], prices: prices[id] ?? [] }));
      const rounds = selectRounds(puzzle.groups.map((g) => ({ level: g.level, productIds: g.productIds, ruleYear: g.ruleYear })), catalog, mulberry32(this.newSeed()));
      if (!this.matches.has(entry.id)) return;
      if (rounds.length === 0) {
        entry.pgPending = false;
        return this.finish(entry);
      }
      entry.pg = { state: startPriceGuess(rounds), endsAt: 0, cancel: null, busy: true };
      entry.pgPending = false;
      await this.openRound(entry);
    } catch (e) {
      console.error('[match] price round failed to start', entry.id, e);
      entry.pgPending = false;
      if (this.matches.has(entry.id)) this.finish(entry);
    }
  }

  /** One timer per price round: at the deadline whoever has not guessed gets the worst guess and the round is revealed. */
  private armPrice(entry: Active): void {
    const pg = entry.pg;
    if (!pg) return;
    pg.cancel?.();
    pg.endsAt = this.now() + entry.state.rules.turnSeconds * 1000;
    const index = pg.state.index;
    pg.cancel = this.schedule(entry.state.rules.turnSeconds * 1000, () => {
      if (!this.matches.has(entry.id) || entry.pg?.state.index !== index) return;
      this.applyPrice(entry, { type: 'timeout' });
    });
  }

  /** A hidden guess in the price round. Idempotent: a second guess in the same round is ignored. */
  submitPrice(userId: string, guessRials: bigint): { ok: true } | { ok: false; error: ErrorCode } {
    const entry = this.entryOf(userId);
    if (!entry) return { ok: false, error: 'NOT_IN_MATCH' };
    if (!entry.pg || entry.pg.busy) return { ok: false, error: 'NO_PRICE_ROUND' };
    const side = entry.state.players.find((p) => p.userId === userId)?.side;
    if (side === undefined) return { ok: false, error: 'NOT_IN_MATCH' };
    this.applyPrice(entry, { type: 'submit_guess', side: side === 0 ? 'a' : 'b', guessRials });
    return { ok: true };
  }

  private applyPrice(entry: Active, cmd: Parameters<typeof applyPriceGuessCommand>[1]): void {
    const pg = entry.pg;
    if (!pg || pg.busy) return;
    const before = pg.state;
    const next = applyPriceGuessCommand(before, cmd);
    if (next === before) return;
    pg.state = next;
    if (next.index === before.index) return this.pushState(entry); // a guess locked in, nothing revealed yet
    pg.cancel?.();
    pg.cancel = null;
    const done = next.revealed[next.revealed.length - 1]!;
    if (!entry.wager) {
      if (next.status === 'finished') return this.completePrice(entry);
      this.armPrice(entry);
      return this.pushState(entry);
    }
    pg.busy = true;
    void this.afterReveal(entry, done);
  }

  /** The wagers of one round are put down before its question is shown; a side that cannot pay sits the round out. */
  private async openRound(entry: Active): Promise<void> {
    const pg = entry.pg;
    if (!pg) return;
    const w = entry.wager;
    const players = entry.state.players;
    if (w && this.deps.stakes?.takeWager) {
      const round = pg.state.index;
      const seats: [WagerSeat, WagerSeat] = ['out', 'out'];
      for (const side of [0, 1] as const) {
        const userId = players[side]!.userId;
        seats[side] = w.isBot(userId) ? 'house' : (await this.deps.stakes.takeWager(entry.id, round, userId, w.amount).catch(() => false)) ? 'in' : 'out';
      }
      entry.pgRound = { index: round, seats };
      if (!this.matches.has(entry.id)) return void this.refundWager(entry);
      for (const side of [0, 1] as const) if (seats[side] === 'out') pg.state = applyPriceGuessCommand(pg.state, { type: 'sit_out', side: side === 0 ? 'a' : 'b' });
      if (pg.state.index !== round) return this.afterReveal(entry, pg.state.revealed[pg.state.revealed.length - 1]!); // nobody could play it
    }
    pg.busy = false;
    this.armPrice(entry);
    this.pushState(entry);
  }

  /** A round was revealed: pay it out, then open the next one or end the match. */
  private async afterReveal(entry: Active, done: RevealedRound): Promise<void> {
    const pg = entry.pg;
    if (!pg) return;
    const round = entry.pgRound;
    entry.pgRound = undefined;
    const w = entry.wager;
    if (round && w && round.index === done.index && this.deps.stakes?.creditWager) {
      const credits = settleWager(w.amount, w.cutPercent, round.seats, done.winner);
      for (const side of [0, 1] as const) if (credits[side] > 0) await this.deps.stakes.creditWager(entry.id, done.index, entry.state.players[side]!.userId, credits[side]).catch((e) => console.error('[wager] credit failed', entry.id, e));
    }
    if (!this.matches.has(entry.id)) return;
    if (pg.state.status === 'finished') {
      pg.busy = false;
      return this.completePrice(entry);
    }
    await this.openRound(entry);
  }

  /** The match ended with wagers still down for the round in play: every one comes back in full. */
  private refundWager(entry: Active): void {
    const round = entry.pgRound;
    entry.pgRound = undefined;
    if (!round || !entry.wager || !this.deps.stakes?.creditWager) return;
    for (const side of [0, 1] as const) {
      if (round.seats[side] === 'in') void this.deps.stakes.creditWager(entry.id, round.index, entry.state.players[side]!.userId, entry.wager.amount).catch((e) => console.error('[wager] refund failed', entry.id, e));
    }
  }

  /** All rounds revealed: the winner and the final tallies come from the shared rules (a tie falls through to the rounds; a locked-out side cannot win off them). */
  private completePrice(entry: Active): void {
    const pg = entry.pg!;
    pg.cancel?.();
    pg.cancel = null;
    const won: [number, number] = [0, 0];
    for (const r of pg.state.revealed) if (r.winner !== 'draw') won[r.winner === 'a' ? 0 : 1] += 1;
    const base = entry.state.result!;
    this.pushState(entry);
    this.finish(entry, { result: { winner: resolveWinner(entry.state, won), reason: base.reason }, scores: finalScores(entry.state, won) });
  }

  /** INTERNAL, for the bot driver only: the real price of the round a bot has not guessed yet. Never sent to any client. */
  priceAnswerFor(userId: string): bigint | null {
    const entry = this.entryOf(userId);
    const pg = entry?.pg;
    if (!entry || !pg || pg.busy || pg.state.status !== 'playing') return null;
    const side = entry.state.players.find((p) => p.userId === userId)?.side;
    if (side === undefined || pg.state.submitted[side === 0 ? 'a' : 'b']) return null;
    return pg.state.rounds[pg.state.index]?.actualRials ?? null;
  }

  private finish(entry: Active, final?: { result: NonNullable<MatchState['result']>; scores: [number, number] }) {
    entry.cancel?.();
    entry.cancel = null;
    this.refundWager(entry);
    const result = final?.result ?? entry.state.result;
    if (result) {
      const ended: MatchEnded = {
        matchId: entry.id,
        result,
        scores: final?.scores ?? [entry.state.scores[0], entry.state.scores[1]],
        groups: [...(entry.puzzles[entry.state.round] ?? entry.puzzles[0]!).groups]
          .sort((a, b) => a.level - b.level)
          .map((g) => ({ level: g.level, titleFa: g.titleFa, explanationFa: g.explanationFa, productIds: [...g.productIds] })) as MatchEnded['groups'],
      };
      for (const p of entry.state.players) this.deps.emit(p.userId, ServerEvent.matchEnded, { ...ended, priceRound: entry.pg ? this.priceViewFor(entry, p.side) : undefined });
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
      void this.deps.stakes.settle(entry.id, players, entry.stakes, { winner: result.winner, reason: result.reason }, entry.tier).catch((e) => console.error('[duel] settle failed', entry.id, e));
    }
    for (const p of entry.state.players) this.byUser.delete(p.userId);
    this.matches.delete(entry.id);
  }
}
