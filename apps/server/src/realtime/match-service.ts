import { randomInt } from 'node:crypto';
import { DEFAULT_MATCH_RULES, THEMED_MATCH_MIN_ROUNDS, TOPIC_PICK_SECONDS, applyDraftPick, draftOpen, draftTurn, expireDraftPick, startDraft, rollGemCard, groupHoldsGem, TEAM_MATCH_BOARDS, applyCommand, settleWager, applyPriceGuessCommand, finalScores, matchClientView, mulberry32, resolveWinner, selectRounds, ServerEvent, startPriceGuess, startTriviaRound, applyTriviaCommand, triviaPoints, toTriviaRoundView, startTeamMatch, otherSide, sideOf, shuffled, toPriceRoundView, trackRules, turnDeadline } from '@dozari/shared';
import type { AgeTrack, TriviaRoundQuestion, TriviaRoundState, CatalogProduct, DraftState, DraftView, ItemCounts, ItemKind, Command, RevealedRound, WagerSeat, ErrorCode, PriceGuessState, Stake, MatchEnded, MatchRules, MatchEvent, MatchEventPayload, MatchFound, MatchState, MatchView, PowerKind, Rng, RuleError } from '@dozari/shared';
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
  /** Topics a themed match can be drafted from (id + Persian name), for the players' track; absent or too few = no draft, random boards. */
  topics?: (tracks: readonly AgeTrack[]) => Promise<{ id: string; nameFa: string }[]>;
  /** Rounds of a queue duel (admin setting `match.duel_rounds`); absent = 1. */
  duelRounds?: () => Promise<number>;
  /** Is the pre-match topic draft on (admin setting `match.topic_draft`)? Absent = off. */
  topicDraft?: () => Promise<boolean>;
  /** Is this account a bot? A bot chooser names its topic by itself after a short pause. */
  isBot?: (userId: string) => boolean;
  /** Bought match items each player holds when a match starts (shuffle / reveal); absent = nobody has any. */
  itemsOf?: (userIds: readonly string[]) => Promise<Record<string, ItemCounts>>;
  /** Takes one unit of a bought item from the inventory; false = none held. Absent = items cannot be used. */
  consumeItem?: (userId: string, effect: 'shuffle_rival' | 'reveal_group') => Promise<boolean>;
  /** Gives back a unit that was taken but not used. */
  refundItem?: (userId: string, effect: 'shuffle_rival' | 'reveal_group') => Promise<void>;
  /** Pushes a server event to every open socket of a user. */
  emit(userId: string, event: string, payload: unknown): void;
  /** Boards of a 2v2 match (admin setting `match.team_boards`); absent = the shared default. */
  teamBoards?: () => Promise<number>;
  /** The match numbers (admin settings turn / mistakes / scoring), read when a match starts; absent or failing = the shared defaults. */
  rules?: () => Promise<MatchRules>;
  /** The gem-card tunables (admin settings), read when a match starts; absent = no gem cards. */
  gemCard?: () => Promise<{ percent: number; amount: number }>;
  /** Pays the gems found behind a card (the caller skips bots); idempotent per `key`. */
  onGem?: (userId: string, amount: number, key: string) => void;
  /** Whether a 1v1 ends with the price-guess round (admin setting `match.price_round`), read when a match starts; absent = no. */
  priceRound?: () => Promise<boolean>;
  /** General-question rounds after the boards of a 1v1 (admin setting `match.trivia_rounds`), read when a match starts; absent or 0 = none. */
  triviaRounds?: () => Promise<number>;
  /** Draws `count` approved questions (choices already shuffled) for a match, preferring the match's topics; fewer or none when the bank is thin. */
  triviaQuestions?: (opts: { topicIds?: readonly string[]; tracks: readonly AgeTrack[]; count: number; rng: Rng; /** The match's players, so the draw can prefer questions they have not seen. */ userIds: readonly string[] }) => Promise<TriviaRoundQuestion[]>;
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
  /** Coin entry of private-table matches (every seated player pays the table's fee; the winning side splits the pot). Absent = tables stay friendly. */
  tableStakes?: {
    open(matchId: string, players: readonly string[], fee: number): Promise<boolean>;
    cancel(matchId: string, players: readonly string[], fee: number): Promise<void>;
    settle(matchId: string, sides: readonly [readonly string[], readonly string[]], fee: number, result: { winner: 0 | 1 | null; reason: string }): Promise<void>;
  };
  /** A player left a running board on purpose (`manual`) or stayed away past the reconnect grace (`absent`): logged for the leave penalty. */
  onLeave?: (info: { userId: string; matchId: string; kind: 'manual' | 'absent' }) => void;
  onEnded?: (info: { players: readonly [string, string]; result: NonNullable<MatchState['result']> }) => void;
  /** A 2v2 ended: every player of both sides with the side they played (the duel hook only sees two players). */
  onTeamEnded?: (info: { players: readonly { userId: string; side: 0 | 1 }[]; result: NonNullable<MatchState['result']> }) => void;
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
  /** The card each board hides a gem behind (`null` = none), index = board; drawn when the match starts, never sent to a client. */
  gems?: { cards: (string | null)[]; amount: number; claimed: boolean[] };
  /** Frozen at the start: this match ends with the price-guess round (1v1 only). */
  priceRound?: boolean;
  /** How many price questions it asks (a table's choice); absent = all of them. */
  priceRoundCount?: number;
  /** The board is over and the price rounds are being drawn (the clients must not see a finished match yet). */
  pgPending?: boolean;
  /** The running price-guess phase; `busy` while a round's wagers are being settled or taken (no guesses then). */
  pg?: { state: PriceGuessState; endsAt: number; cancel: (() => void) | null; busy?: boolean };
  /** Frozen at the start: how many general questions end this match (0 = none; 1v1 only), and what to draw them from. */
  triviaCount?: number;
  triviaTopics?: readonly string[];
  tracks?: readonly AgeTrack[];
  /** Round wins of the price-guess round, held while the general-question round runs. */
  won?: [number, number];
  /** The running general-question round. */
  tq?: { state: TriviaRoundState; endsAt: number; cancel: (() => void) | null };
  /** Per-round coin wager (stake matches only), frozen at the start. */
  wager?: { amount: number; cutPercent: number; isBot: (userId: string) => boolean };
  /** Wagers put down for the round in play and not settled yet. */
  pgRound?: { index: number; seats: [WagerSeat, WagerSeat] };
  /** A private table's entry fee and who sat on which side when it started (settled when the match ends). */
  table?: { fee: number; sides: [string[], string[]] };
  /** Who sits where, as sent with `match:found` (a returning player gets it again on resume). */
  players?: MatchFound['players'];
  /** The last few submitted selections of the board in play, for the stands (every player sees every guess and its result, so it is public). */
  recent?: { side: 0 | 1; itemIds: readonly string[]; outcome: 'correct' | 'one_away' | 'wrong' }[];
  /** Themed match: Persian topic name of each round, in round order. */
  topicNames?: string[];
  /** Latest proposal per side (2v2); only that side's own players ever see it. */
  proposals: [{ by: string; itemIds: readonly string[] } | null, { by: string; itemIds: readonly string[] } | null];
}

interface Draft {
  id: string;
  /** Players of each side (one for a duel, two for a 2v2); the draft belongs to all of them. */
  sides: readonly [readonly string[], readonly string[]];
  /** Display name of every player, for «X is choosing». */
  players: ReadonlyMap<string, string>;
  rng: Rng;
  names: Map<string, string>;
  state: DraftState;
  endsAt: number;
  cancel: (() => void) | null;
  /** The options `start` was called with, replayed (with the picked topics) when the draft is over. */
  opts: NonNullable<Parameters<MatchService['start']>[2]> & NonNullable<Parameters<MatchService['startTeam']>[1]>;
}

const RULE_TO_ERROR: Record<RuleError, ErrorCode> = {
  MATCH_FINISHED: 'MATCH_FINISHED',
  UNKNOWN_PLAYER: 'NOT_IN_MATCH',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  NOT_CAPTAIN: 'NOT_CAPTAIN',
  NOT_TEAM_MATCH: 'NOT_TEAM_MATCH',
  INVALID_SELECTION: 'INVALID_SELECTION',
  DUPLICATE_SELECTION: 'DUPLICATE_SELECTION',
  NO_POWER: 'NO_POWER',
  FROZEN: 'FROZEN',
  POWER_USED: 'POWER_USED',
};

/** How many latest guesses the stands see. */
const RECENT_GUESSES = 6;

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
  /** Topic drafts running before a match starts; a drafting player counts as «in a match» (cannot queue again). */
  private readonly drafts = new Map<string, Draft>();
  private readonly draftOf = new Map<string, string>();
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

  /** The other players of the match `userId` sits in (rival, and teammates in a 2v2); empty when none. */
  othersOf(userId: string): string[] {
    const entry = this.entryOf(userId);
    return entry ? entry.state.players.filter((p) => p.userId !== userId && !entry.state.gone.includes(p.userId)).map((p) => p.userId) : [];
  }

  inMatch(userId: string): boolean {
    return this.byUser.has(userId) || this.draftOf.has(userId);
  }

  /** Starts a match for a paired couple; false when it could not be created (no puzzle, unknown or busy player). */
  async start(a: string, b: string, opts: { /** The draft's result: one topic id per round (set by the service itself). */ topicIds?: readonly string[]; /** Names of those topics, for the screen. */ topicNames?: readonly string[]; friendly?: boolean; tier?: string; /** Table match: boards to play (1 = one puzzle then the price round) and the entry fee each player pays. */ boards?: number; fee?: number; /** Price-guess questions after the boards: 0 = none, absent = the `match.price_round` setting. */ priceRounds?: number } = {}): Promise<boolean> {
    if (a === b || this.inMatch(a) || this.inMatch(b)) return false;
    const [pa, pb] = await Promise.all([this.deps.profile(a), this.deps.profile(b)]);
    if (!pa || !pb) return false;
    // The stronger of the two sets the puzzle tier (docs/logic/progression.md).
    const tracks = await this.tracksOf(a);
    const level = Math.max(pa.level, pb.level);
    // A queue duel (it always names a stake table) plays the admin's round count; tables and others say how many boards they want.
    const boardCount = Math.max(1, opts.topicIds?.length ?? opts.boards ?? (opts.tier !== undefined ? await this.duelRounds() : 1));
    // Three or more rounds with enough topics: the sides first name the topic of each round (the draft), then the match starts from `topicIds`.
    if (!opts.topicIds && boardCount >= THEMED_MATCH_MIN_ROUNDS && (await this.topicDraftOn())) {
      const topics = await this.topicsFor(tracks);
      if (topics.length >= boardCount) return this.beginDraft([[a], [b]], new Map([[a, pa.nickname], [b, pb.nickname]]), topics, boardCount, { ...opts, boards: boardCount });
    }
    // Several boards: the same different-puzzle rules as 2v2; one board keeps the classic path.
    const picked = boardCount > 1 ? await this.pickBoards(boardCount, level, tracks, [a, b], opts.topicIds) : [];
    const puzzle = boardCount > 1 ? picked[0] : await pickUnseen(this.deps.history, [a, b], [], (exclude) => this.deps.puzzles.pickRandom({ level, tracks, exclude }));
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
    const fee = opts.fee ?? 0;
    if (fee > 0 && this.deps.tableStakes && !(await this.deps.tableStakes.open(id, [a, b], fee))) return false;
    if (this.inMatch(a) || this.inMatch(b)) {
      // Raced with another start while the table fees were taken: give them back.
      if (fee > 0) await this.deps.tableStakes?.cancel(id, [a, b], fee);
      return false;
    }
    const boards = boardCount > 1 ? picked : [puzzle];
    const rules = await this.matchRules();
    const items = await this.itemsFor([a, b]);
    const state = startTeamMatch(boards.map(toSolo), [[a], [b]], rng, this.now(), undefined, rules, items);
    const entry: Active = { id, puzzles: boards, state, cancel: null, stakes, tier: stakes ? opts.tier : undefined, priceRound: opts.priceRounds === undefined ? await this.wantsPriceRound() : opts.priceRounds > 0, priceRoundCount: opts.priceRounds, proposals: [null, null], table: fee > 0 && this.deps.tableStakes ? { fee, sides: [[a], [b]] } : undefined, topicNames: opts.topicNames ? [...opts.topicNames] : undefined, triviaCount: await this.triviaCount(), triviaTopics: opts.topicIds, tracks };
    if (entry.priceRound && stakes) entry.wager = (await this.deps.stakes?.wagerRules?.().catch(() => null)) ?? undefined;
    entry.gems = await this.rollGems(boards);
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
  async startTeam(sides: readonly [readonly [string, string], readonly [string, string]], opts: { /** The draft's result: one topic id per board (set by the service itself). */ topicIds?: readonly string[]; /** Names of those topics, for the screen. */ topicNames?: readonly string[]; /** Boards to play; absent = the `match.team_boards` setting. */ boards?: number; /** Entry fee each of the four pays (private tables). */ fee?: number; /** Ignored: a 2v2 has no price-guess questions. */ priceRounds?: number } = {}): Promise<boolean> {
    const all = [...sides[0], ...sides[1]];
    if (new Set(all).size !== 4 || all.some((u) => this.inMatch(u))) return false;
    const profiles = await Promise.all(all.map((u) => this.deps.profile(u)));
    if (profiles.some((p) => !p)) return false;
    const boardCount = opts.topicIds?.length ?? opts.boards ?? (await this.boardCount());
    const tracks = await this.tracksOf(sides[0][0]);
    // Three or more boards with enough topics: the four take turns naming the topic of each board (docs/logic/themed-rounds.md), then this runs again with `topicIds`.
    if (!opts.topicIds && boardCount >= THEMED_MATCH_MIN_ROUNDS && (await this.topicDraftOn())) {
      const topics = await this.topicsFor(tracks);
      if (topics.length >= boardCount) return this.beginDraft(sides, new Map(all.map((u, i) => [u, profiles[i]!.nickname])), topics, boardCount, { ...opts, boards: boardCount });
    }
    // The strongest player sets the puzzle tier, so nobody gets dumbed down (docs/logic/progression.md).
    const boards = await this.pickBoards(boardCount, Math.max(...profiles.map((p) => p!.level)), tracks, all, opts.topicIds);
    if (boards.length === 0) return false;
    if (all.some((u) => this.inMatch(u))) return false; // raced with another start while loading
    const id = uuidv7();
    const fee = opts.fee ?? 0;
    if (fee > 0 && this.deps.tableStakes && !(await this.deps.tableStakes.open(id, all, fee))) return false;
    if (all.some((u) => this.inMatch(u))) {
      if (fee > 0) await this.deps.tableStakes?.cancel(id, all, fee);
      return false;
    }
    const entry: Active = { id, puzzles: boards, table: fee > 0 && this.deps.tableStakes ? { fee, sides: [[...sides[0]], [...sides[1]]] } : undefined, state: startTeamMatch(boards.map(toSolo), sides, mulberry32(this.newSeed()), this.now(), undefined, await this.matchRules(), await this.itemsFor(all)), cancel: null, proposals: [null, null], topicNames: opts.topicNames ? [...opts.topicNames] : undefined };
    entry.gems = await this.rollGems(boards);
    this.matches.set(id, entry);
    for (const u of all) this.byUser.set(u, id);
    const players: MatchFound['players'] = all.map((u, i) => ({ userId: u, side: i < 2 ? 0 : 1, ...(profiles[i] as PlayerProfile) }));
    entry.players = players;
    for (const [i, u] of all.entries()) this.deps.emit(u, ServerEvent.matchFound, { matchId: id, you: i < 2 ? 0 : 1, youId: u, players } satisfies MatchFound);
    this.pushState(entry);
    this.armTimer(entry);
    return true;
  }

  /** Draws, per board, the card a gem hides behind (admin setting `gemcard.percent`); undefined when gem cards are off. */
  private async rollGems(boards: readonly ServedPuzzle[]): Promise<Active['gems']> {
    const rules = await this.deps.gemCard?.().catch(() => null);
    if (!rules || rules.percent <= 0) return undefined;
    const rng = mulberry32(this.newSeed());
    const cards = boards.map((b) => rollGemCard(Object.keys(b.items), rules.percent, rng));
    return cards.some(Boolean) ? { cards, amount: rules.amount, claimed: cards.map(() => false) } : undefined;
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

  private async pickBoards(n: number, level: number | undefined, tracks: readonly AgeTrack[] | undefined, players: readonly string[], topicIds?: readonly string[]): Promise<ServedPuzzle[]> {
    const out: ServedPuzzle[] = [];
    for (let i = 0; i < n * 3 && out.length < n; i++) {
      // Never the same board twice in one match, and none any of the four has played before. A themed round asks for its own topic first and
      // only falls back to any puzzle when that topic has run dry for these players.
      const topicId = topicIds?.[out.length];
      const topical = topicId ? await pickUnseen(this.deps.history, players, out.map((o) => o.id), (exclude) => this.deps.puzzles.pickRandom({ level, tracks, exclude, topicId })) : null;
      const p = topical ?? (await pickUnseen(this.deps.history, players, out.map((o) => o.id), (exclude) => this.deps.puzzles.pickRandom({ level, tracks, exclude })));
      if (!p) break;
      if (!out.some((o) => o.id === p.id)) out.push(p);
    }
    return out;
  }

  // ---- topic draft ----------------------------------------------------------------------------------------------

  private async duelRounds(): Promise<number> {
    try {
      return Math.max(1, (await this.deps.duelRounds?.()) ?? 1);
    } catch {
      return 1;
    }
  }

  private async topicDraftOn(): Promise<boolean> {
    try {
      return (await this.deps.topicDraft?.()) === true && !!this.deps.topics;
    } catch {
      return false;
    }
  }

  private async topicsFor(tracks: readonly AgeTrack[]): Promise<{ id: string; nameFa: string }[]> {
    try {
      return (await this.deps.topics?.(tracks)) ?? [];
    } catch {
      return [];
    }
  }

  private draftView(d: Draft, userId: string, cancelled = false): DraftView {
    const you = this.draftSideOf(d, userId);
    const turn = draftTurn(d.state);
    const chooserId = !cancelled && turn && turn.chooser !== 'system' ? this.draftChooser(d, turn.round, turn.chooser) : null;
    const name = (id: string) => d.names.get(id) ?? '';
    return {
      draftId: d.id,
      status: cancelled ? 'cancelled' : d.state.status,
      you,
      rounds: d.state.rounds,
      round: turn?.round ?? d.state.rounds - 1,
      chooser: cancelled ? null : (turn?.chooser ?? null),
      chooserId,
      chooserName: chooserId ? d.players.get(chooserId) : undefined,
      yourTurn: chooserId === userId,
      endsAt: d.endsAt,
      open: draftOpen(d.state).map((id) => ({ id, nameFa: name(id) })),
      picked: d.state.picks.map((p, round) => ({ round, topicId: p.topic, nameFa: name(p.topic), by: p.by })),
    };
  }

  private pushDraft(d: Draft, cancelled = false) {
    for (const u of [...d.sides[0], ...d.sides[1]]) this.deps.emit(u, ServerEvent.draftState, this.draftView(d, u, cancelled));
  }

  private draftSideOf(d: Draft, userId: string): 0 | 1 {
    return d.sides[0].includes(userId) ? 0 : 1;
  }

  /** Who of a side's players names `round`: the sides alternate, and inside a team the members take their turns in order (A1, B1, A2, B2, …). */
  private draftChooser(d: Draft, round: number, side: 0 | 1): string {
    const team = d.sides[side];
    return team[Math.floor(round / 2) % team.length]!;
  }

  private beginDraft(sides: readonly [readonly string[], readonly string[]], players: ReadonlyMap<string, string>, topics: { id: string; nameFa: string }[], rounds: number, opts: NonNullable<Parameters<MatchService['start']>[2]> | Parameters<MatchService['startTeam']>[1]): boolean {
    const rng = mulberry32(this.newSeed());
    const id = uuidv7();
    const d: Draft = { id, sides, players, rng, names: new Map(topics.map((t) => [t.id, t.nameFa])), state: startDraft(topics.map((t) => t.id), rounds, rng() < 0.5 ? 0 : 1, rng), endsAt: 0, cancel: null, opts: (opts ?? {}) as Draft['opts'] };
    this.drafts.set(id, d);
    for (const u of [...sides[0], ...sides[1]]) this.draftOf.set(u, id);
    this.armDraft(d);
    return true;
  }

  /** One timer per draft, for the round now being named; a bot chooser answers after a short pause, a human gets `TOPIC_PICK_SECONDS`. */
  private armDraft(d: Draft) {
    d.cancel?.();
    d.cancel = null;
    if (d.state.status === 'done') {
      this.pushDraft(d);
      void this.finishDraft(d);
      return;
    }
    const turn = draftTurn(d.state);
    const chooser = turn && turn.chooser !== 'system' ? this.draftChooser(d, turn.round, turn.chooser) : '';
    const bot = this.deps.isBot?.(chooser) === true;
    const ms = bot ? 1200 + Math.floor(d.rng() * 1800) : TOPIC_PICK_SECONDS * 1000;
    d.endsAt = this.now() + ms;
    this.pushDraft(d);
    d.cancel = this.schedule(ms, () => {
      if (!this.drafts.has(d.id)) return;
      d.state = expireDraftPick(d.state, d.rng);
      this.armDraft(d);
    });
  }

  /** A side names the topic of the round in play (a topic id or `random`). */
  pickTopic(userId: string, topic: string): { ok: true } | { ok: false; error: ErrorCode } {
    const d = this.drafts.get(this.draftOf.get(userId) ?? '');
    if (!d) return { ok: false, error: 'NO_DRAFT' };
    const turn = draftTurn(d.state);
    // In a 2v2 only the teammate whose turn it is may name the topic, not the partner.
    if (turn && turn.chooser !== 'system' && this.draftChooser(d, turn.round, turn.chooser) !== userId) return { ok: false, error: 'NOT_YOUR_PICK' };
    const r = applyDraftPick(d.state, this.draftSideOf(d, userId), topic, d.rng);
    if ('error' in r) return { ok: false, error: r.error === 'NOT_YOUR_PICK' ? 'NOT_YOUR_PICK' : r.error === 'UNKNOWN_TOPIC' ? 'UNKNOWN_TOPIC' : 'NO_DRAFT' };
    d.state = r;
    this.armDraft(d);
    return { ok: true };
  }

  private releaseDraft(d: Draft) {
    d.cancel?.();
    d.cancel = null;
    this.drafts.delete(d.id);
    for (const u of [...d.sides[0], ...d.sides[1]]) this.draftOf.delete(u);
  }

  /** Everyone named a topic (or the clock did): the match starts from the picked topics. */
  private async finishDraft(d: Draft) {
    this.releaseDraft(d);
    const picks = d.state.picks.map((p) => p.topic);
    const named = { topicIds: picks, topicNames: picks.map((id) => d.names.get(id) ?? '') };
    const started = await (d.sides[0].length === 2
      ? this.startTeam([[d.sides[0][0]!, d.sides[0][1]!], [d.sides[1][0]!, d.sides[1][1]!]], { ...d.opts, ...named })
      : this.start(d.sides[0][0]!, d.sides[1][0]!, { ...d.opts, ...named })
    ).catch(() => false);
    if (!started) this.pushDraft(d, true);
  }

  /** A player left before the first board: no match, no penalty, nothing was charged. */
  private cancelDraft(d: Draft) {
    this.releaseDraft(d);
    this.pushDraft(d, true);
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

  /** Bought items each player brings into the match (a snapshot of the inventory); a failing lookup means none. */
  private async itemsFor(userIds: readonly string[]): Promise<Record<string, ItemCounts>> {
    try {
      return (await this.deps.itemsOf?.(userIds)) ?? {};
    } catch {
      return {};
    }
  }

  /**
   * Uses a bought item (shuffle the rival's cards / reveal a group). The command is checked first without side effects, the item is
   * taken from the inventory only if it would work, and a unit taken for a command that then fails (a lost race) is given back.
   */
  async useItem(userId: string, kind: ItemKind): Promise<{ ok: true } | { ok: false; error: ErrorCode }> {
    const entry = this.entryOf(userId);
    if (!entry) return { ok: false, error: 'NOT_IN_MATCH' };
    if (this.inExtras(entry)) return { ok: false, error: 'NOT_YOUR_TURN' };
    const side = sideOf(entry.state, userId);
    let order: string[] | undefined;
    if (kind === 'shuffle' && side !== null && entry.state.sep) {
      const rival = entry.state.sep.remaining[otherSide(side)];
      const rng = mulberry32(this.newSeed());
      order = shuffled(rival, rng);
      for (let i = 0; i < 4 && order.length > 1 && order.every((id, n) => id === rival[n]); i++) order = shuffled(rival, rng);
    }
    const cmd: Command = { t: 'power', by: userId, kind, order };
    const dry = applyCommand(entry.state, cmd, { now: this.now() });
    if ('error' in dry) return { ok: false, error: RULE_TO_ERROR[dry.error] };
    const effect = kind === 'shuffle' ? 'shuffle_rival' : 'reveal_group';
    if (!(await this.deps.consumeItem?.(userId, effect))) return { ok: false, error: 'NO_POWER' };
    const out = this.apply(entry, cmd);
    if (!out.ok) {
      await this.deps.refundItem?.(userId, effect).catch(() => undefined);
      return out;
    }
    if (kind === 'shuffle' && side !== null) entry.proposals[otherSide(side)] = null;
    return out;
  }

  /** A power-up on the player's turn (docs/logic/game-rules.md §Power-ups); the magnifier's two cards reach the user's own side only. */
  power(userId: string, kind: PowerKind): { ok: true } | { ok: false; error: ErrorCode } {
    const entry = this.entryOf(userId);
    if (!entry) return { ok: false, error: 'NOT_IN_MATCH' };
    if (this.inExtras(entry)) return { ok: false, error: 'NOT_YOUR_TURN' };
    return this.apply(entry, { t: 'power', by: userId, kind });
  }

  leave(userId: string, kind: 'manual' | 'absent' = 'manual'): { ok: true } | { ok: false; error: ErrorCode } {
    const draft = this.drafts.get(this.draftOf.get(userId) ?? '');
    if (draft) {
      this.cancelDraft(draft);
      return { ok: true };
    }
    const entry = this.entryOf(userId);
    if (!entry) return { ok: false, error: 'NOT_IN_MATCH' };
    if (this.inExtras(entry)) {
      // The board is over: leaving the price or question round just ends the match with the puzzle's result.
      entry.pg?.cancel?.();
      entry.tq?.cancel?.();
      this.finish(entry);
      return { ok: true };
    }
    const wasPlaying = entry.state.status === 'playing';
    const out = this.apply(entry, { t: 'leave', by: userId });
    // Leaving a running board is logged for the leave penalty (day ban, monthly badge); a finished match costs nothing.
    if (out.ok && wasPlaying) {
      try {
        this.deps.onLeave?.({ userId, matchId: entry.id, kind });
      } catch {
        /* the penalty log must not break leaving */
      }
    }
    // A teammate who leaves a running 2v2 is free to queue again; the match carries on without them.
    if (out.ok && entry.state.status === 'playing') this.byUser.delete(userId);
    return out;
  }

  /** Re-sends the current snapshot to a returning player. */
  resume(userId: string, matchId?: string): { ok: true } | { ok: false; error: ErrorCode } {
    const draft = this.drafts.get(this.draftOf.get(userId) ?? '');
    if (draft) {
      this.deps.emit(userId, ServerEvent.draftState, this.draftView(draft, userId));
      return { ok: true };
    }
    const entry = this.entryOf(userId);
    if (!entry || (matchId && entry.id !== matchId)) return { ok: false, error: matchId ? 'UNKNOWN_MATCH' : 'NOT_IN_MATCH' };
    // A player who joins the match late (a table started it before their screen opened) learns who plays whom.
    const you = entry.state.players.find((p) => p.userId === userId)?.side;
    if (entry.players && you !== undefined) this.deps.emit(userId, ServerEvent.matchFound, { matchId: entry.id, you, youId: userId, players: entry.players } satisfies MatchFound);
    this.deps.emit(userId, ServerEvent.matchState, this.view(entry, userId));
    return { ok: true };
  }

  /** What a spectator may see of the match a player sits in: the board from seat 0's side with nothing private (no proposal, no price round), who plays, card names. */
  spectate(playerId: string): { view: MatchView; players: MatchFound['players']; names: Record<string, string>; inPriceRound: boolean; recent: { side: 0 | 1; names: string[]; outcome: 'correct' | 'one_away' | 'wrong' }[] } | null {
    const entry = this.entryOf(playerId);
    const first = entry?.state.players[0]?.userId;
    if (!entry || !first) return null;
    const current = entry.puzzles[entry.state.round] ?? entry.puzzles[0]!;
    const names = Object.fromEntries(Object.entries(current.items).map(([id, it]) => [id, it.nameFa]));
    return { view: { ...this.view(entry, first), youId: undefined, proposal: null, priceRound: null, triviaRound: null }, players: entry.players ?? [], names, inPriceRound: this.inExtras(entry), recent: (entry.recent ?? []).map((g) => ({ side: g.side, names: g.itemIds.map((id) => names[id] ?? ''), outcome: g.outcome })) };
  }

  /** Both sides' scores of the match a player sits in (the lobby shows them on a playing table), or null. */
  scoresOf(playerId: string): [number, number] | null {
    const st = this.entryOf(playerId)?.state;
    const s = st ? (st.sep ? st.boardsWon : st.scores) : undefined;
    return s ? [s[0], s[1]] : null;
  }

  private entryOf(userId: string): Active | undefined {
    const id = this.byUser.get(userId);
    return id ? this.matches.get(id) : undefined;
  }

  private apply(entry: Active, cmd: Command): { ok: true } | { ok: false; error: ErrorCode } {
    const round = entry.state.round;
    const r = applyCommand(entry.state, cmd, { now: this.now() });
    if ('error' in r) return { ok: false, error: RULE_TO_ERROR[r.error] };
    entry.state = r.state;
    const events: MatchEvent[] = [...r.events];
    for (const e of r.events) {
      // A correct guess whose group holds this board's gem card pays the solver (once per board).
      if (e.t === 'guess' && e.outcome === 'correct' && cmd.t === 'submit' && entry.gems && !entry.gems.claimed[round] && groupHoldsGem(entry.gems.cards[round], e.itemIds)) {
        entry.gems.claimed[round] = true;
        events.push({ t: 'gem', userId: cmd.by, amount: entry.gems.amount });
        try {
          this.deps.onGem?.(cmd.by, entry.gems.amount, `gem_card:${entry.id}-${round}:${cmd.by}`);
        } catch {
          /* a gem must not break the match */
        }
      }
      if (e.t === 'proposal') entry.proposals[e.side] = e.itemIds.length > 0 ? { by: e.by, itemIds: e.itemIds } : null;
      if (e.t === 'turn') entry.proposals = [null, null];
      if (e.t === 'guess') entry.recent = [...(entry.recent ?? []), { side: e.side, itemIds: e.itemIds, outcome: e.outcome }].slice(-RECENT_GUESSES);
      if (e.t === 'board') entry.recent = [];
    }
    this.broadcast(entry, events);
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
    const inPrice = this.inExtras(entry);
    const text = new Map(current.groups.map((g) => [g.level, g]));
    return {
      matchId: entry.id,
      you: v.you,
      youId: userId,
      team: entry.state.players.length > 2,
      round: v.round,
      rounds: v.rounds,
      ...(entry.topicNames ? { topics: entry.topicNames } : {}),
      cards: v.cards.map((id) => ({ id, nameFa: info[id]?.nameFa ?? id, unitFa: info[id]?.unitFa ?? null, iconKey: info[id]?.iconKey ?? null })),
      solved: v.solved.map((g) => ({ level: g.level, titleFa: text.get(g.level)?.titleFa ?? '', explanationFa: text.get(g.level)?.explanationFa ?? '', productIds: [...g.productIds], by: g.by })),
      ...(v.found ? { found: [v.found[0], v.found[1]] as [number, number], boardsWon: [v.boardsWon![0], v.boardsWon![1]] as [number, number] } : {}),
      scores: [v.scores[0], v.scores[1]],
      mistakes: [v.mistakes[0], v.mistakes[1]],
      lockedOut: [v.lockedOut[0], v.lockedOut[1]],
      powers: { ...v.powers },
      items: { ...v.items },
      powerUsed: v.powerUsed,
      frozenUntil: [v.frozenUntil[0], v.frozenUntil[1]],
      turn: v.turn,
      captain: [v.captain[0], v.captain[1]],
      proposal: entry.proposals[v.you] ? { by: entry.proposals[v.you]!.by, itemIds: [...entry.proposals[v.you]!.itemIds] } : null,
      turnId: v.turnId,
      turnEndsAt: v.turnEndsAt,
      status: inPrice ? 'playing' : v.status,
      result: inPrice ? null : v.result,
      priceRound: entry.pg ? this.priceViewFor(entry, v.you) : null,
      triviaRound: entry.tq ? toTriviaRoundView(entry.tq.state, v.you === 0 ? 'a' : 'b', entry.tq.endsAt) : null,
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
        // Separate boards: the rival learns only «found N of 4», never which cards, which guess or how it went.
        if (entry.state.sep && 'side' in e && e.side !== p.side) {
          if (e.t === 'guess' || e.t === 'group_solved' || e.t === 'timeout') continue;
        }
        if (e.t === 'finished' && entry.pgPending) continue; // the match is not over for the clients yet
        // The magnifier's cards are private to the side that used it.
        const out = e.t === 'board_done' ? this.boardDone(entry, e.round) : e.t === 'power' && e.itemIds && e.side !== p.side ? { t: 'power' as const, side: e.side, kind: e.kind } : e;
        this.deps.emit(p.userId, ServerEvent.matchEvent, out);
      }
    }
    if (entry.state.status === 'finished') {
      if (entry.pgPending) void (entry.priceRound ? this.startPriceRound(entry) : this.startTrivia(entry));
      else this.finish(entry);
    } else {
      this.armTimer(entry);
    }
  }

  /** The duel ends with the price-guess round: a 1v1 whose puzzle was finished by play (not a forfeit), both players still in. */
  private wantsPriceNow(entry: Active): boolean {
    const r = entry.state.result;
    return (!!entry.priceRound || (entry.triviaCount ?? 0) > 0) && entry.state.players.length === 2 && !!r && (r.reason === 'solved' || r.reason === 'locked_out') && entry.state.gone.length === 0;
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
      const all = selectRounds(puzzle.groups.map((g) => ({ level: g.level, productIds: g.productIds, ruleYear: g.ruleYear })), catalog, mulberry32(this.newSeed()));
      const rounds = entry.priceRoundCount === undefined ? all : all.slice(0, entry.priceRoundCount);
      if (!this.matches.has(entry.id)) return;
      if (rounds.length === 0) return void this.startTrivia(entry);
      entry.pg = { state: startPriceGuess(rounds), endsAt: 0, cancel: null, busy: true };
      entry.pgPending = false;
      await this.openRound(entry);
    } catch (e) {
      console.error('[match] price round failed to start', entry.id, e);
      if (this.matches.has(entry.id)) void this.startTrivia(entry);
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
    entry.won = won;
    if ((entry.triviaCount ?? 0) > 0) {
      // The question round comes next; the price round stays on screen (pending) while the questions are drawn.
      entry.pgPending = true;
      return void this.startTrivia(entry);
    }
    this.pushState(entry);
    this.finishExtras(entry);
  }

  /** The extras are over: the winner and the final tallies come from the shared rules over the price rounds and the right answers together. */
  private finishExtras(entry: Active): void {
    const won: [number, number] = entry.won ? [entry.won[0], entry.won[1]] : [0, 0];
    if (entry.tq) {
      const t = triviaPoints(entry.tq.state);
      won[0] += t[0];
      won[1] += t[1];
    }
    const base = entry.state.result!;
    this.finish(entry, { result: { winner: resolveWinner(entry.state, won), reason: base.reason }, scores: finalScores(entry.state, won) });
  }

  private inExtras(entry: Active): boolean {
    return !!entry.pg || !!entry.pgPending || !!entry.tq;
  }

  private async triviaCount(): Promise<number> {
    try {
      return Math.max(0, Math.min(10, Math.floor((await this.deps.triviaRounds?.()) ?? 0)));
    } catch {
      return 0;
    }
  }

  /** Draws the general questions; with none to ask the match simply ends with what it has. */
  private async startTrivia(entry: Active): Promise<void> {
    try {
      const count = entry.triviaCount ?? 0;
      const questions = count > 0 && this.deps.triviaQuestions ? await this.deps.triviaQuestions({ topicIds: entry.triviaTopics, tracks: entry.tracks ?? ['adult'], count, rng: mulberry32(this.newSeed()), userIds: entry.state.players.map((p) => p.userId) }) : [];
      if (!this.matches.has(entry.id)) return;
      entry.pgPending = false;
      if (questions.length === 0) {
        this.pushState(entry);
        return this.entryHasPrice(entry) ? this.finishExtras(entry) : this.finish(entry);
      }
      entry.tq = { state: startTriviaRound(questions), endsAt: 0, cancel: null };
      this.armTrivia(entry);
      this.pushState(entry);
    } catch (e) {
      console.error('[match] trivia round failed to start', entry.id, e);
      entry.pgPending = false;
      if (this.matches.has(entry.id)) {
        if (this.entryHasPrice(entry)) this.finishExtras(entry);
        else this.finish(entry);
      }
    }
  }

  private entryHasPrice(entry: Active): boolean {
    return !!entry.pg;
  }

  private armTrivia(entry: Active): void {
    const tq = entry.tq;
    if (!tq) return;
    tq.cancel?.();
    tq.endsAt = this.now() + entry.state.rules.turnSeconds * 1000;
    const index = tq.state.index;
    tq.cancel = this.schedule(entry.state.rules.turnSeconds * 1000, () => {
      if (!this.matches.has(entry.id) || entry.tq?.state.index !== index) return;
      this.applyTrivia(entry, { type: 'timeout' });
    });
  }

  /** A hidden answer in the question round. Idempotent: a second answer to the same question is ignored. */
  submitTrivia(userId: string, index: number): { ok: true } | { ok: false; error: ErrorCode } {
    const entry = this.entryOf(userId);
    if (!entry) return { ok: false, error: 'NOT_IN_MATCH' };
    if (!entry.tq || entry.tq.state.status !== 'playing') return { ok: false, error: 'NO_TRIVIA_ROUND' };
    const side = entry.state.players.find((p) => p.userId === userId)?.side;
    if (side === undefined) return { ok: false, error: 'NOT_IN_MATCH' };
    this.applyTrivia(entry, { type: 'answer', side: side === 0 ? 'a' : 'b', index });
    return { ok: true };
  }

  private applyTrivia(entry: Active, cmd: Parameters<typeof applyTriviaCommand>[1]): void {
    const tq = entry.tq;
    if (!tq) return;
    const before = tq.state;
    const next = applyTriviaCommand(before, cmd);
    if (next === before) return;
    tq.state = next;
    if (next.index === before.index && next.status === 'playing') return this.pushState(entry); // an answer locked in, nothing revealed yet
    tq.cancel?.();
    tq.cancel = null;
    if (next.status === 'finished') {
      this.pushState(entry);
      return this.finishExtras(entry);
    }
    this.armTrivia(entry);
    this.pushState(entry);
  }

  /** INTERNAL, for the bot driver only: the right choice of the question a bot has not answered yet. Never sent to any client. */
  triviaAnswerFor(userId: string): number | null {
    const entry = this.entryOf(userId);
    const tq = entry?.tq;
    if (!entry || !tq || tq.state.status !== 'playing') return null;
    const side = entry.state.players.find((p) => p.userId === userId)?.side;
    if (side === undefined || tq.state.answered[side === 0 ? 'a' : 'b']) return null;
    return tq.state.questions[tq.state.index]?.correctIndex ?? null;
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
    entry.tq?.cancel?.();
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
      for (const p of entry.state.players) this.deps.emit(p.userId, ServerEvent.matchEnded, { ...ended, priceRound: entry.pg ? this.priceViewFor(entry, p.side) : undefined, triviaRound: entry.tq ? toTriviaRoundView(entry.tq.state, p.side === 0 ? 'a' : 'b', entry.tq.endsAt) : undefined });
    }
    const duel = entry.state.players.length === 2;
    if (result && duel) {
      try {
        this.deps.onEnded?.({ players: [entry.state.players[0]!.userId, entry.state.players[1]!.userId], result });
      } catch {
        /* a notification hook must never break the match flow */
      }
    }
    if (result && !duel) {
      try {
        this.deps.onTeamEnded?.({ players: entry.state.players.map((p) => ({ userId: p.userId, side: p.side })), result });
      } catch {
        /* same: a hook must never break the match flow */
      }
    }
    if (result && entry.stakes && this.deps.stakes) {
      const players: [string, string] = [entry.state.players[0]!.userId, entry.state.players[1]!.userId];
      void this.deps.stakes.settle(entry.id, players, entry.stakes, { winner: result.winner, reason: result.reason }, entry.tier).catch((e) => console.error('[duel] settle failed', entry.id, e));
    }
    if (result && entry.table && this.deps.tableStakes) {
      const t = entry.table;
      void this.deps.tableStakes.settle(entry.id, t.sides, t.fee, { winner: result.winner, reason: result.reason }).catch((e) => console.error('[table] settle failed', entry.id, e));
    }
    for (const p of entry.state.players) this.byUser.delete(p.userId);
    this.matches.delete(entry.id);
  }
}
