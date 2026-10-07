import { TABLE_PRICE_ROUNDS_MAX, TABLE_PUBLIC_LIST_MAX, TABLE_REQUESTS_MAX, TABLE_REQUEST_TTL_MS, canMeet, clampTableRounds, makeTableCode, tableEntryOk, tableMinEntry, trackRank, normalizeTableCode, seatsOfFormat } from '@dozari/shared';
import type { AgeTrack, CreateTableBody, LiveNotice, PublicTable, TableError, TableFormat, TableView } from '@dozari/shared';

/** A closed public table stays in the open-tables list this long, labelled as closed (view only). */
const RECENT_MS = 30 * 60_000;
const RECENT_MAX = 20;
/** A spectator counts as watching this long after their last look. */
const WATCH_TTL_MS = 12_000;
/** A turned-down request is remembered this long so the asker sees the answer. */
const DENIED_MS = 60_000;

export interface TableDeps {
  profileOf(userId: string): Promise<{ nickname: string; avatarKey: string } | null>;
  startMatch(a: string, b: string, opts?: { boards: number; fee: number; priceRounds: number }): Promise<boolean>;
  /** Starts a 2v2 (`sides[s]` = the two players of side s); omit to refuse 2v2 tables. */
  startTeam?(sides: readonly [readonly [string, string], readonly [string, string]], opts?: { boards: number; fee: number; priceRounds: number }): Promise<boolean>;
  inMatch(userId: string): boolean;
  /** A player's age track (docs/logic/age-tracks.md): a table seats one track only. Absent = everybody is adult. */
  trackOf?(userId: string): Promise<AgeTrack>;
  /** A kid/teen with no linked guardian may not open or join a table (docs/logic/age-tracks.md). */
  socialBlocked?(userId: string): Promise<boolean>;
  /** Does this player belong to a family (a guardian with children, or a child with a guardian)? Only they may open a family table. */
  hasFamily?(userId: string): Promise<boolean>;
  /** Are these two the same family: a guardian and their child, or two children of one guardian? */
  sameFamily?(a: string, b: string): Promise<boolean>;
  /** The guardian switched friend duels and tables off for this child: the app hides them, the server refuses. */
  duelsOff?(userId: string): Promise<boolean>;
  /** May coins move for this player (not a kid or teen)? Absent = yes. */
  coinsAllowed?(userId: string): Promise<boolean>;
  /** The player's coin balance, to check an entry fee. Absent = nobody can pay a fee, so only free tables exist. */
  balanceOf?(userId: string): Promise<number>;
  /** Is this account a bot? A bot seat never pays an entry fee (the house funds its share). */
  isBot?(userId: string): boolean;
  /** A live nudge to a player (a join request, the host's answer). */
  notify?(userId: string, notice: LiveNotice): void;
  idleMs(): Promise<number>;
  now?: () => number;
  rng?: () => number;
}

interface Table {
  code: string;
  name: string;
  icon: string;
  format: TableFormat;
  /** A guardian's table with their own children: it crosses tracks and is closed to everybody else. */
  family: boolean;
  /** Team of each seated player (0/1). */
  sides: Map<string, 0 | 1>;
  requireReady: boolean;
  locked: boolean;
  /** Boards played and the coins each player puts in. */
  rounds: number;
  /** Price-guess questions after the boards (0 = none; a 2v2 has none). */
  priceRounds: number;
  entryFee: number;
  /** Hidden from the open-tables list (family tables always are). */
  isPrivate: boolean;
  hostNickname: string;
  hostAvatarKey: string;
  /** People asking to sit down (user id → asked at) and turned down recently. */
  requests: Map<string, number>;
  denied: Map<string, number>;
  hostId: string;
  /** The host's track when the table opened; only players of it can see, join or start at the table. */
  track: AgeTrack;
  /** Seated players in join order; the host is first. */
  seated: string[];
  ready: Set<string>;
  expiresAt: number;
  /** A lobby table opened by a bot to show the game is busy (docs/logic/bots.md §Lobby tables). `fillAt` = when its bots start once a person sat down. */
  ambient?: { bots: Set<string>; fillAt: number | null; started: boolean };
}

export type TableResult<T = object> = ({ ok: true } & T) | { ok: false; error: TableError };

/**
 * Private tables (docs/logic/matchmaking.md): a host opens a table with a 5-character code, a friend joins by it, the host
 * starts a live duel. In memory like the matches themselves; a table that is not started in time closes. Friendly
 * only for now (no entry fee, no payout) — the economy of duels is not built yet.
 */
export class TableService {
  private readonly tables = new Map<string, Table>();
  private readonly byUser = new Map<string, string>();
  /** Public tables that closed lately, shown view-only so the list is never bare. */
  private readonly recent: (PublicTable & { closedAt: number })[] = [];
  /** Who looked at each playing table lately (user id → last poll); a watcher counts for `WATCH_TTL_MS`. */
  private readonly watching = new Map<string, Map<string, number>>();

  constructor(private readonly deps: TableDeps) {}

  /** May this player see and sit at the table: the same track, or for a family table the same family as the host. */
  private async mayEnter(t: Table, userId: string): Promise<boolean> {
    if (t.family) return userId === t.hostId || ((await this.deps.sameFamily?.(t.hostId, userId)) ?? false);
    return canMeet(t.track, await this.trackOf(userId));
  }

  private async trackOf(userId: string): Promise<AgeTrack> {
    try {
      return (await this.deps.trackOf?.(userId)) ?? 'adult';
    } catch {
      return 'adult';
    }
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  private watcherCount(code: string): number {
    const w = this.watching.get(code);
    if (!w) return 0;
    for (const [u, at] of w) if (this.now() - at > WATCH_TTL_MS) w.delete(u);
    if (w.size === 0) this.watching.delete(code);
    return w.size;
  }

  private close(t: Table): void {
    this.watching.delete(t.code);
    if (this.tables.delete(t.code) && !t.isPrivate && !t.family) {
      this.recent.unshift({ ...this.row(t, 'none'), closedAt: this.now() });
      this.recent.length = Math.min(this.recent.length, RECENT_MAX);
    }
    for (const u of t.seated) if (this.byUser.get(u) === t.code) this.byUser.delete(u);
  }

  private live(codeRaw: string): Table | null {
    const code = normalizeTableCode(codeRaw);
    const t = code ? this.tables.get(code) : undefined;
    if (!t) return null;
    if (t.expiresAt <= this.now()) {
      this.close(t);
      return null;
    }
    return t;
  }

  private leaveCurrent(userId: string): void {
    const code = this.byUser.get(userId);
    const t = code ? this.tables.get(code) : undefined;
    if (t) this.removeSeat(t, userId);
    this.byUser.delete(userId);
  }

  /** Host leaving closes the table; a guest leaving frees the seat. */
  private removeSeat(t: Table, userId: string): void {
    if (t.hostId === userId) return this.close(t);
    t.seated = t.seated.filter((u) => u !== userId);
    t.sides.delete(userId);
    t.ready.delete(userId);
    this.byUser.delete(userId);
    if (t.ambient && !t.ambient.started && !t.seated.some((u) => !t.ambient!.bots.has(u))) t.ambient.fillAt = null;
  }

  async create(hostId: string, body: Omit<CreateTableBody, 'family' | 'rounds' | 'entryFee' | 'isPrivate' | 'priceRounds'> & { family?: boolean; rounds?: number; entryFee?: number; isPrivate?: boolean; priceRounds?: number }): Promise<TableResult<{ table: TableView }>> {
    if (body.family) {
      // A family table is the guardian's own flow: no track gate, and the guardian's duel switch does not apply to a table they sit at.
      if (!(await this.deps.hasFamily?.(hostId))) return { ok: false, error: 'INVALID' };
    } else {
      if (await this.deps.socialBlocked?.(hostId)) return { ok: false, error: 'NEEDS_GUARDIAN' };
      if (await this.deps.duelsOff?.(hostId)) return { ok: false, error: 'FEATURE_OFF' };
    }
    if (this.deps.inMatch(hostId)) return { ok: false, error: 'IN_MATCH' };
    // Rounds and entry: the more rounds, the higher the minimum entry. Where coins do not move (kid, teen, family) the entry is 0.
    const rounds = clampTableRounds(body.rounds ?? 1);
    const coins = !body.family && (await this.coinsAllowed(hostId)) && !!this.deps.balanceOf;
    const entryFee = coins ? body.entryFee ?? tableMinEntry(rounds) : 0;
    if (coins && !tableEntryOk(entryFee, rounds, true)) return { ok: false, error: 'LOW_ENTRY' };
    if (entryFee > 0 && (await this.deps.balanceOf!(hostId)) < entryFee) return { ok: false, error: 'NO_COINS' };
    this.leaveCurrent(hostId);
    const rng = this.deps.rng ?? Math.random;
    let code = makeTableCode(rng);
    for (let i = 0; i < 20 && this.tables.has(code); i++) code = makeTableCode(rng);
    if (this.tables.has(code)) return { ok: false, error: 'BUSY' };
    if (body.format === '2v2' && !this.deps.startTeam) return { ok: false, error: 'INVALID' };
    const host = (await this.deps.profileOf(hostId)) ?? { nickname: '؟', avatarKey: 'avatar-01' };
    const t: Table = { code, name: body.name, icon: body.icon, format: body.format, family: !!body.family, rounds, priceRounds: body.format === '2v2' ? 0 : Math.min(TABLE_PRICE_ROUNDS_MAX, Math.max(0, Math.floor(body.priceRounds ?? TABLE_PRICE_ROUNDS_MAX))), entryFee, isPrivate: !!body.isPrivate || !!body.family, hostNickname: host.nickname, hostAvatarKey: host.avatarKey, requests: new Map(), denied: new Map(), sides: new Map([[hostId, 0]]), requireReady: body.requireReady, locked: false, hostId, track: await this.trackOf(hostId), seated: [hostId], ready: new Set(), expiresAt: this.now() + (await this.deps.idleMs()) };
    this.tables.set(code, t);
    this.byUser.set(hostId, code);
    return { ok: true, table: await this.view(t, hostId) };
  }

  async get(userId: string, code: string): Promise<TableView | null> {
    const t = this.live(code);
    if (!t || (!t.seated.includes(userId) && !(await this.mayEnter(t, userId)))) return null;
    return this.view(t, userId);
  }

  /** Everyone seated at the table, or null when it is gone or the player does not sit there (the chat of a table is for its players only). */
  memberIds(userId: string, code: string): string[] | null {
    const t = this.live(code);
    return t && t.seated.includes(userId) ? [...t.seated] : null;
  }

  /** The table the player currently sits at, if any (to reopen the screen). */
  async mine(userId: string): Promise<TableView | null> {
    const code = this.byUser.get(userId);
    return code ? this.get(userId, code) : null;
  }

  async join(userId: string, code: string): Promise<TableResult<{ table: TableView }>> {
    const t = this.live(code);
    if (!t) return { ok: false, error: normalizeTableCode(code) && this.tables.has(normalizeTableCode(code)!) ? 'EXPIRED' : 'NOT_FOUND' };
    if (t.seated.includes(userId)) return { ok: true, table: await this.view(t, userId) };
    if (!t.family) {
      if (await this.deps.socialBlocked?.(userId)) return { ok: false, error: 'NEEDS_GUARDIAN' };
      if (await this.deps.duelsOff?.(userId)) return { ok: false, error: 'FEATURE_OFF' };
    }
    // Another track's table (or a family table of another family) reads as no table at all: no refusal to explain, nothing to find.
    if (!(await this.mayEnter(t, userId))) return { ok: false, error: 'NOT_FOUND' };
    if (this.deps.inMatch(userId)) return { ok: false, error: 'IN_MATCH' };
    if (t.locked) return { ok: false, error: 'LOCKED' };
    const seated = await this.sit(t, userId);
    return seated.ok ? { ok: true, table: await this.view(t, userId) } : seated;
  }

  /** May this player's coins move (not a kid or teen)? A failing lookup reads as no. */
  private async coinsAllowed(userId: string): Promise<boolean> {
    try {
      return (await this.deps.coinsAllowed?.(userId)) ?? true;
    } catch {
      return false;
    }
  }

  /** Can this player pay the table's entry? A table with a fee needs a player whose coins may move and who has them. */
  private async canPay(t: Table, userId: string): Promise<boolean> {
    if (t.entryFee <= 0 || this.deps.isBot?.(userId)) return true;
    if (!this.deps.balanceOf || !(await this.coinsAllowed(userId))) return false;
    return (await this.deps.balanceOf(userId).catch(() => 0)) >= t.entryFee;
  }

  /** Puts a player in the emptiest seat (the caller checked access and locks); leaves their old table first. */
  private async sit(t: Table, userId: string): Promise<TableResult> {
    if (this.deps.inMatch(userId)) return { ok: false, error: 'IN_MATCH' };
    if (t.seated.length >= seatsOfFormat(t.format)) return { ok: false, error: 'FULL' };
    if (!(await this.canPay(t, userId))) return { ok: false, error: 'NO_COINS' };
    if (t.seated.length >= seatsOfFormat(t.format)) return { ok: false, error: 'FULL' }; // raced while the balance was read
    this.leaveCurrent(userId);
    t.seated.push(userId);
    t.requests.delete(userId);
    // The emptier team; on a tie the second team (so a 1v1 guest faces the host, and the third player joins the host).
    const n0 = [...t.sides.values()].filter((s) => s === 0).length;
    const n1 = t.sides.size - n0;
    t.sides.set(userId, n1 < n0 ? 1 : n0 < n1 ? 0 : t.seated.length % 2 === 1 ? 0 : 1);
    this.byUser.set(userId, t.code);
    if (t.ambient) {
      t.expiresAt = Math.max(t.expiresAt, this.now() + 60_000);
      if (t.ambient.fillAt === null) t.ambient.fillAt = this.now() + 3000 + Math.round((this.deps.rng ?? Math.random)() * 5000);
    }
    return { ok: true };
  }

  /** Why a player may not even ask to sit at / join this table, or null. */
  private async refusal(t: Table, userId: string): Promise<TableError | null> {
    if (t.seated.includes(userId)) return 'ALREADY_IN';
    if (!t.family) {
      if (await this.deps.socialBlocked?.(userId)) return 'NEEDS_GUARDIAN';
      if (await this.deps.duelsOff?.(userId)) return 'FEATURE_OFF';
    }
    if (!(await this.mayEnter(t, userId))) return 'NOT_FOUND';
    if (this.deps.inMatch(userId)) return 'IN_MATCH';
    if (t.locked) return 'LOCKED';
    if (t.seated.length >= seatsOfFormat(t.format)) return 'FULL';
    return null;
  }

  private row(t: Table, yourRequest: PublicTable['yourRequest']): PublicTable {
    return { code: t.code, name: t.name, icon: t.icon, format: t.format, rounds: t.rounds, priceRounds: t.priceRounds, entryFee: t.entryFee, seats: seatsOfFormat(t.format), taken: t.seated.length, hostNickname: t.hostNickname, hostAvatarKey: t.hostAvatarKey, yourRequest, watchers: this.watcherCount(t.code), status: this.statusOf(t) };
  }

  private statusOf(t: Table): PublicTable['status'] {
    if (t.seated.some((u) => this.deps.inMatch(u))) return 'playing';
    if (t.seated.length >= seatsOfFormat(t.format)) return 'full';
    return t.locked ? 'locked' : 'open';
  }

  /**
   * The open-tables list: every public table the player could see (open ones first, then full, playing and locked ones), then the ones
   * that closed lately. Tables that cannot take a request are listed with their status and are view-only, so the list is rarely bare.
   */
  async listPublic(userId: string): Promise<PublicTable[]> {
    this.sweep();
    const rows: PublicTable[] = [];
    if (!(await this.deps.socialBlocked?.(userId)) && !(await this.deps.duelsOff?.(userId))) {
      for (const t of this.tables.values()) {
        if (t.isPrivate || t.family || t.seated.includes(userId) || !(await this.mayEnter(t, userId))) continue;
        rows.push(this.row(t, t.requests.has(userId) ? 'pending' : t.denied.has(userId) ? 'denied' : 'none'));
      }
    }
    const rank = { open: 0, full: 1, locked: 2, playing: 3, closed: 4 } as const;
    rows.sort((x, y) => rank[x.status] - rank[y.status]);
    const closed = this.recent.filter((r) => this.now() - r.closedAt < RECENT_MS).map(({ closedAt: _at, ...r }): PublicTable => ({ ...r, status: 'closed', yourRequest: 'none' }));
    return [...rows, ...closed].slice(0, TABLE_PUBLIC_LIST_MAX);
  }

  /** Drops lapsed requests and old «turned down» marks, and closes tables past their time. */
  private sweep(): void {
    const t = this.now();
    for (const table of [...this.tables.values()]) {
      if (table.expiresAt <= t) {
        this.close(table);
        continue;
      }
      for (const [u, at] of table.requests) if (t - at > TABLE_REQUEST_TTL_MS) table.requests.delete(u);
      for (const [u, at] of table.denied) if (t - at > DENIED_MS) table.denied.delete(u);
    }
    while (this.recent.length > 0 && t - this.recent[this.recent.length - 1]!.closedAt >= RECENT_MS) this.recent.pop();
  }

  /** Asks the host of a public table to let the player sit down; the host is nudged live and answers with `answer`. */
  async request(userId: string, code: string): Promise<TableResult> {
    this.sweep();
    const t = this.live(code);
    if (!t || t.isPrivate || t.family) return { ok: false, error: 'NOT_FOUND' };
    const refused = await this.refusal(t, userId);
    if (refused) return { ok: false, error: refused };
    if (!(await this.canPay(t, userId))) return { ok: false, error: 'NO_COINS' };
    if (t.requests.has(userId)) return { ok: true };
    if (t.requests.size >= TABLE_REQUESTS_MAX) return { ok: false, error: 'TOO_MANY' };
    t.denied.delete(userId);
    t.requests.set(userId, this.now());
    const me = (await this.deps.profileOf(userId)) ?? { nickname: '؟', avatarKey: 'avatar-01' };
    this.deps.notify?.(t.hostId, { kind: 'table_request', from: me.nickname, code: t.code });
    return { ok: true };
  }

  /** The host lets a requester in (they are seated at once) or turns them down; either way the requester is nudged. */
  async answer(hostId: string, userId: string, accept: boolean): Promise<TableResult> {
    this.sweep();
    const t = this.tableOf(hostId);
    if (!t || t.hostId !== hostId) return { ok: false, error: 'NOT_HOST' };
    if (!t.requests.has(userId)) return { ok: false, error: 'NOT_REQUESTED' };
    t.requests.delete(userId);
    if (!accept) {
      t.denied.set(userId, this.now());
      this.deps.notify?.(userId, { kind: 'table_answer', accepted: false, code: t.code });
      return { ok: true };
    }
    const refused = await this.refusal(t, userId);
    const seated = refused ? ({ ok: false, error: refused } as const) : await this.sit(t, userId);
    if (!seated.ok) {
      this.deps.notify?.(userId, { kind: 'table_answer', accepted: false, code: t.code });
      return seated;
    }
    this.deps.notify?.(userId, { kind: 'table_answer', accepted: true, code: t.code });
    return { ok: true };
  }

  leave(userId: string): TableResult {
    const code = this.byUser.get(userId);
    const t = code ? this.tables.get(code) : undefined;
    if (!t) return { ok: false, error: 'NOT_IN' };
    this.removeSeat(t, userId);
    return { ok: true };
  }

  kick(hostId: string, targetId: string): TableResult {
    const t = this.tableOf(hostId);
    if (!t || t.hostId !== hostId) return { ok: false, error: 'NOT_HOST' };
    if (targetId === hostId || !t.seated.includes(targetId)) return { ok: false, error: 'NOT_IN' };
    this.removeSeat(t, targetId);
    return { ok: true };
  }

  /** Host: block further joins (or open again) and add time. */
  async setLocked(hostId: string, locked: boolean): Promise<TableResult> {
    const t = this.tableOf(hostId);
    if (!t || t.hostId !== hostId) return { ok: false, error: 'NOT_HOST' };
    t.locked = locked;
    return { ok: true };
  }

  async extend(hostId: string): Promise<TableResult<{ expiresAt: number }>> {
    const t = this.tableOf(hostId);
    if (!t || t.hostId !== hostId) return { ok: false, error: 'NOT_HOST' };
    t.expiresAt = this.now() + (await this.deps.idleMs());
    return { ok: true, expiresAt: t.expiresAt };
  }

  /** A seated player moves to the other team of a 2v2 table when it has room. */
  setSide(userId: string, side: 0 | 1): TableResult {
    const t = this.tableOf(userId);
    if (!t) return { ok: false, error: 'NOT_IN' };
    if (t.format !== '2v2') return { ok: false, error: 'NOT_TEAM' };
    if (t.sides.get(userId) === side) return { ok: true };
    if ([...t.sides.values()].filter((s) => s === side).length >= seatsOfFormat(t.format) / 2) return { ok: false, error: 'FULL' };
    t.sides.set(userId, side);
    t.ready.delete(userId);
    return { ok: true };
  }

  setReady(userId: string, ready: boolean): TableResult {
    const t = this.tableOf(userId);
    if (!t) return { ok: false, error: 'NOT_IN' };
    if (ready) t.ready.add(userId);
    else t.ready.delete(userId);
    return { ok: true };
  }

  /** Host starts the duel (and any rematch: the table stays after the match). */
  async start(hostId: string): Promise<TableResult> {
    const t = this.tableOf(hostId);
    if (!t || t.hostId !== hostId) return { ok: false, error: 'NOT_HOST' };
    if (t.seated.length < seatsOfFormat(t.format)) return { ok: false, error: 'NEED_PLAYERS' };
    // A seated player may have moved track since joining: such a seat is freed, never played.
    for (const u of [...t.seated]) if (!(await this.mayEnter(t, u))) this.removeSeat(t, u);
    if (!this.tables.has(t.code)) return { ok: false, error: 'NOT_FOUND' };
    if (t.seated.length < seatsOfFormat(t.format)) return { ok: false, error: 'NEED_PLAYERS' };
    const guests = t.seated.filter((u) => u !== hostId);
    if (t.requireReady && guests.some((g) => !t.ready.has(g))) return { ok: false, error: 'NOT_READY' };
    if (t.seated.some((u) => this.deps.inMatch(u))) return { ok: false, error: 'IN_MATCH' };
    // Everybody pays the entry at the start: whoever cannot keeps the match from starting (the host sees why).
    for (const u of t.seated) if (!(await this.canPay(t, u))) return { ok: false, error: 'NO_COINS' };
    const opts = { boards: t.rounds, fee: t.entryFee, priceRounds: t.priceRounds };
    if (t.format === '2v2') {
      const side = (n: 0 | 1) => t.seated.filter((u) => t.sides.get(u) === n);
      const [a, b] = [side(0), side(1)];
      if (a.length !== 2 || b.length !== 2) return { ok: false, error: 'NEED_PLAYERS' };
      // The match draws its puzzles from the first player's track pool: at a family table the youngest sits first.
      const [sa, sb] = t.family ? [await this.youngestFirst(a), await this.youngestFirst(b)] : [a, b];
      const sides: [string[], string[]] = t.family && (await this.rankOf(sb[0]!)) < (await this.rankOf(sa[0]!)) ? [sb, sa] : [sa, sb];
      if (!(await this.deps.startTeam?.([[sides[0][0]!, sides[0][1]!], [sides[1][0]!, sides[1][1]!]], opts))) return { ok: false, error: 'START_FAILED' };
    } else {
      const [first, second] = t.family ? await this.youngestFirst([hostId, guests[0]!]) : [hostId, guests[0]!];
      if (!(await this.deps.startMatch(first!, second!, opts))) return { ok: false, error: 'START_FAILED' };
    }
    t.ready.clear();
    t.expiresAt = this.now() + (await this.deps.idleMs());
    return { ok: true };
  }

  /**
   * A look at a public table whose match is running: who may watch (the same people who see it in the list), and a seated player whose match to show.
   * Counts the caller as a watcher for a few seconds. Anything else (private, family, not playing, another track) reads as no such table.
   */
  async watch(userId: string, code: string): Promise<TableResult<{ table: { name: string; icon: string; format: TableFormat }; playerId: string; watchers: number }>> {
    const t = this.live(code);
    if (!t || t.isPrivate || t.family) return { ok: false, error: 'NOT_FOUND' };
    if (!t.seated.includes(userId) && (!(await this.mayEnter(t, userId)) || (await this.deps.socialBlocked?.(userId)) || (await this.deps.duelsOff?.(userId)))) return { ok: false, error: 'NOT_FOUND' };
    const playerId = t.seated.find((u) => this.deps.inMatch(u));
    if (!playerId) return { ok: false, error: 'NOT_FOUND' };
    const w = this.watching.get(t.code) ?? new Map<string, number>();
    w.set(userId, this.now());
    this.watching.set(t.code, w);
    return { ok: true, table: { name: t.name, icon: t.icon, format: t.format }, playerId, watchers: this.watcherCount(t.code) };
  }

  /** Codes of the public tables whose match is running (the stands bots may sit in). */
  playingCodes(): string[] {
    return [...this.tables.values()].filter((t) => !t.isPrivate && !t.family && this.live(t.code) && t.seated.some((u) => this.deps.inMatch(u))).map((t) => t.code);
  }

  /** Who is in the stands of a table right now. */
  watcherIds(code: string): string[] {
    this.watcherCount(code);
    return [...(this.watching.get(code)?.keys() ?? [])];
  }

  /** A bot takes a seat in the stands for `forMs` (it is counted like any watcher). */
  botWatch(code: string, botId: string, forMs: number): void {
    const w = this.watching.get(code) ?? new Map<string, number>();
    w.set(botId, this.now() + forMs - WATCH_TTL_MS);
    this.watching.set(code, w);
  }

  /** Is this player seated at any table (a bot busy at a lobby table is not offered for another one)? */
  isSeated(userId: string): boolean {
    return this.byUser.has(userId);
  }

  /**
   * A bot-made public lobby table: `hostId` and `extraBots` are bot accounts already seated (the other seats stay free for people).
   * A bot never pays: the table's fee is asked of people only, and the house funds the bots' share of the pot.
   */
  async createAmbient(hostId: string, o: { name: string; icon: string; format: TableFormat; rounds: number; priceRounds: number; extraBots: string[]; ttlMs: number; /** Coins each person puts in (bots pay nothing; the house funds their share). */ entryFee?: number; /** Seat bots at every seat (a bots-only table to start at once). */ full?: boolean }): Promise<string | null> {
    const rng = this.deps.rng ?? Math.random;
    let code = makeTableCode(rng);
    for (let i = 0; i < 20 && this.tables.has(code); i++) code = makeTableCode(rng);
    if (this.tables.has(code) || (o.format === '2v2' && !this.deps.startTeam)) return null;
    const seated = [hostId, ...o.extraBots].slice(0, seatsOfFormat(o.format) - (o.full ? 0 : 1));
    const sides = new Map<string, 0 | 1>();
    seated.forEach((u, i) => sides.set(u, (i % 2) as 0 | 1));
    const host = (await this.deps.profileOf(hostId)) ?? { nickname: '؟', avatarKey: 'avatar-01' };
    const t: Table = { code, name: o.name, icon: o.icon, format: o.format, family: false, rounds: clampTableRounds(o.rounds), priceRounds: o.format === '2v2' ? 0 : Math.min(TABLE_PRICE_ROUNDS_MAX, Math.max(0, Math.floor(o.priceRounds))), entryFee: o.entryFee ?? 0, isPrivate: false, hostNickname: host.nickname, hostAvatarKey: host.avatarKey, requests: new Map(), denied: new Map(), sides, requireReady: false, locked: false, hostId, track: 'adult', seated, ready: new Set(), expiresAt: this.now() + o.ttlMs, ambient: { bots: new Set(seated), fillAt: null, started: false } };
    this.tables.set(code, t);
    for (const u of seated) this.byUser.set(u, code);
    return code;
  }

  /** People waiting for the answer of a bot host (the lobby answers them after a human-like pause). */
  ambientRequests(): { code: string; hostId: string; userId: string; at: number }[] {
    const out: { code: string; hostId: string; userId: string; at: number }[] = [];
    for (const t of this.tables.values()) {
      if (!t.ambient || t.ambient.started || !this.live(t.code)) continue;
      for (const [userId, at] of t.requests) out.push({ code: t.code, hostId: t.hostId, userId, at });
    }
    return out;
  }

  /** Lobby tables where a person sat down and the bots' human-like wait is over: `need` = how many bot seats are still missing. */
  ambientDue(): { code: string; need: number }[] {
    const out: { code: string; need: number }[] = [];
    for (const t of this.tables.values()) {
      const a = t.ambient;
      if (!a || a.started || a.fillAt === null || a.fillAt > this.now() || !this.live(t.code)) continue;
      out.push({ code: t.code, need: seatsOfFormat(t.format) - t.seated.length });
    }
    return out;
  }

  /** Seats `botIds` into the free seats of a lobby table (teams stay 2+2) and starts it; a table that cannot start goes back to waiting. */
  async fillAndStart(code: string, botIds: string[]): Promise<boolean> {
    const t = this.live(code);
    if (!t?.ambient) return false;
    for (const b of botIds) {
      if (t.seated.length >= seatsOfFormat(t.format)) break;
      const n0 = [...t.sides.values()].filter((x) => x === 0).length;
      t.sides.set(b, n0 <= t.sides.size - n0 ? 0 : 1);
      t.seated.push(b);
      t.ambient.bots.add(b);
      this.byUser.set(b, t.code);
    }
    const ok = (await this.start(t.hostId)).ok;
    if (ok) t.ambient.started = true;
    else t.ambient.fillAt = this.now() + 5000;
    return ok;
  }

  /** Housekeeping for lobby tables: close the ones whose match is over, and bot-only ones past their time. */
  sweepAmbient(): void {
    for (const t of [...this.tables.values()]) {
      const a = t.ambient;
      if (!a) continue;
      if (a.started && !t.seated.some((u) => this.deps.inMatch(u))) this.close(t);
      else if (!a.started && t.expiresAt <= this.now() && !t.seated.some((u) => !a.bots.has(u))) this.close(t);
    }
  }

  /** How many lobby tables are bots only and playing among themselves (the stands of the lobby). */
  ambientPlayingCount(): number {
    return [...this.tables.values()].filter((t) => t.ambient?.started && !t.seated.some((u) => !t.ambient!.bots.has(u))).length;
  }

  /** How many lobby tables are still waiting for a person (to keep the lobby topped up). */
  ambientOpenCount(): number {
    return [...this.tables.values()].filter((t) => t.ambient && !t.ambient.started && !t.seated.some((u) => !t.ambient!.bots.has(u))).length;
  }

  private async rankOf(userId: string): Promise<number> {
    return trackRank(await this.trackOf(userId));
  }

  /** The same players, the youngest track first (a stable order otherwise). */
  private async youngestFirst(ids: readonly string[]): Promise<string[]> {
    const ranked = await Promise.all(ids.map(async (id, i) => ({ id, i, rank: await this.rankOf(id) })));
    return ranked.sort((x, y) => x.rank - y.rank || x.i - y.i).map((r) => r.id);
  }

  private tableOf(userId: string): Table | null {
    const code = this.byUser.get(userId);
    return code ? this.live(code) : null;
  }

  private async requestRows(t: Table): Promise<TableView['requests']> {
    const rows: TableView['requests'] = [];
    for (const [id, at] of [...t.requests.entries()].sort((x, y) => x[1] - y[1])) {
      if (this.now() - at > TABLE_REQUEST_TTL_MS) continue;
      const p = (await this.deps.profileOf(id)) ?? { nickname: '؟', avatarKey: 'avatar-01' };
      rows.push({ id, nickname: p.nickname, avatarKey: p.avatarKey });
    }
    return rows;
  }

  private async view(t: Table, forUser: string): Promise<TableView> {
    const players = [];
    for (const id of t.seated) {
      const p = (await this.deps.profileOf(id)) ?? { nickname: '؟', avatarKey: 'avatar-01' };
      players.push({ id, nickname: p.nickname, avatarKey: p.avatarKey, ready: t.ready.has(id), isHost: id === t.hostId, isYou: id === forUser, side: t.sides.get(id) ?? 0 });
    }
    return { code: t.code, name: t.name, icon: t.icon, format: t.format, family: t.family, requireReady: t.requireReady, locked: t.locked, hostId: t.hostId, youAreHost: t.hostId === forUser, youAreIn: t.seated.includes(forUser), expiresAt: t.expiresAt, inMatch: t.seated.some((u) => this.deps.inMatch(u)), players, seats: seatsOfFormat(t.format), rounds: t.rounds, priceRounds: t.priceRounds, entryFee: t.entryFee, isPrivate: t.isPrivate, requests: forUser === t.hostId ? await this.requestRows(t) : [] };
  }
}
