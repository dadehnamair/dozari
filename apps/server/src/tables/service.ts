import { canMeet, makeTableCode, normalizeTableCode, seatsOfFormat } from '@dozari/shared';
import type { AgeTrack, CreateTableBody, TableError, TableFormat, TableView } from '@dozari/shared';

export interface TableDeps {
  profileOf(userId: string): Promise<{ nickname: string; avatarKey: string } | null>;
  startMatch(a: string, b: string): Promise<boolean>;
  /** Starts a 2v2 (`sides[s]` = the two players of side s); omit to refuse 2v2 tables. */
  startTeam?(sides: readonly [readonly [string, string], readonly [string, string]]): Promise<boolean>;
  inMatch(userId: string): boolean;
  /** A player's age track (docs/logic/age-tracks.md): a table seats one track only. Absent = everybody is adult. */
  trackOf?(userId: string): Promise<AgeTrack>;
  /** A kid/teen with no linked guardian may not open or join a table (docs/logic/age-tracks.md). */
  socialBlocked?(userId: string): Promise<boolean>;
  idleMs(): Promise<number>;
  now?: () => number;
  rng?: () => number;
}

interface Table {
  code: string;
  name: string;
  icon: string;
  format: TableFormat;
  /** Team of each seated player (0/1). */
  sides: Map<string, 0 | 1>;
  requireReady: boolean;
  locked: boolean;
  hostId: string;
  /** The host's track when the table opened; only players of it can see, join or start at the table. */
  track: AgeTrack;
  /** Seated players in join order; the host is first. */
  seated: string[];
  ready: Set<string>;
  expiresAt: number;
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

  constructor(private readonly deps: TableDeps) {}

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

  private close(t: Table): void {
    this.tables.delete(t.code);
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
  }

  async create(hostId: string, body: CreateTableBody): Promise<TableResult<{ table: TableView }>> {
    if (await this.deps.socialBlocked?.(hostId)) return { ok: false, error: 'NEEDS_GUARDIAN' };
    if (this.deps.inMatch(hostId)) return { ok: false, error: 'IN_MATCH' };
    this.leaveCurrent(hostId);
    const rng = this.deps.rng ?? Math.random;
    let code = makeTableCode(rng);
    for (let i = 0; i < 20 && this.tables.has(code); i++) code = makeTableCode(rng);
    if (this.tables.has(code)) return { ok: false, error: 'BUSY' };
    if (body.format === '2v2' && !this.deps.startTeam) return { ok: false, error: 'INVALID' };
    const t: Table = { code, name: body.name, icon: body.icon, format: body.format, sides: new Map([[hostId, 0]]), requireReady: body.requireReady, locked: false, hostId, track: await this.trackOf(hostId), seated: [hostId], ready: new Set(), expiresAt: this.now() + (await this.deps.idleMs()) };
    this.tables.set(code, t);
    this.byUser.set(hostId, code);
    return { ok: true, table: await this.view(t, hostId) };
  }

  async get(userId: string, code: string): Promise<TableView | null> {
    const t = this.live(code);
    if (!t || (!t.seated.includes(userId) && !canMeet(t.track, await this.trackOf(userId)))) return null;
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
    if (await this.deps.socialBlocked?.(userId)) return { ok: false, error: 'NEEDS_GUARDIAN' };
    // Another track's table reads as no table at all: no refusal to explain, nothing to find.
    if (!canMeet(t.track, await this.trackOf(userId))) return { ok: false, error: 'NOT_FOUND' };
    if (this.deps.inMatch(userId)) return { ok: false, error: 'IN_MATCH' };
    if (t.locked) return { ok: false, error: 'LOCKED' };
    if (t.seated.length >= seatsOfFormat(t.format)) return { ok: false, error: 'FULL' };
    this.leaveCurrent(userId);
    t.seated.push(userId);
    // The emptier team; on a tie the second team (so a 1v1 guest faces the host, and the third player joins the host).
    const n0 = [...t.sides.values()].filter((s) => s === 0).length;
    const n1 = t.sides.size - n0;
    t.sides.set(userId, n1 < n0 ? 1 : n0 < n1 ? 0 : t.seated.length % 2 === 1 ? 0 : 1);
    this.byUser.set(userId, t.code);
    return { ok: true, table: await this.view(t, userId) };
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
    for (const u of [...t.seated]) if (!canMeet(t.track, await this.trackOf(u))) this.removeSeat(t, u);
    if (!this.tables.has(t.code)) return { ok: false, error: 'NOT_FOUND' };
    if (t.seated.length < seatsOfFormat(t.format)) return { ok: false, error: 'NEED_PLAYERS' };
    const guests = t.seated.filter((u) => u !== hostId);
    if (t.requireReady && guests.some((g) => !t.ready.has(g))) return { ok: false, error: 'NOT_READY' };
    if (t.seated.some((u) => this.deps.inMatch(u))) return { ok: false, error: 'IN_MATCH' };
    if (t.format === '2v2') {
      const side = (n: 0 | 1) => t.seated.filter((u) => t.sides.get(u) === n);
      const [a, b] = [side(0), side(1)];
      if (a.length !== 2 || b.length !== 2) return { ok: false, error: 'NEED_PLAYERS' };
      if (!(await this.deps.startTeam?.([[a[0]!, a[1]!], [b[0]!, b[1]!]]))) return { ok: false, error: 'START_FAILED' };
    } else if (!(await this.deps.startMatch(hostId, guests[0]!))) return { ok: false, error: 'START_FAILED' };
    t.ready.clear();
    t.expiresAt = this.now() + (await this.deps.idleMs());
    return { ok: true };
  }

  private tableOf(userId: string): Table | null {
    const code = this.byUser.get(userId);
    return code ? this.live(code) : null;
  }

  private async view(t: Table, forUser: string): Promise<TableView> {
    const players = [];
    for (const id of t.seated) {
      const p = (await this.deps.profileOf(id)) ?? { nickname: '؟', avatarKey: 'avatar-01' };
      players.push({ id, nickname: p.nickname, avatarKey: p.avatarKey, ready: t.ready.has(id), isHost: id === t.hostId, isYou: id === forUser, side: t.sides.get(id) ?? 0 });
    }
    return { code: t.code, name: t.name, icon: t.icon, format: t.format, requireReady: t.requireReady, locked: t.locked, hostId: t.hostId, youAreHost: t.hostId === forUser, youAreIn: t.seated.includes(forUser), expiresAt: t.expiresAt, inMatch: t.seated.some((u) => this.deps.inMatch(u)), players, seats: seatsOfFormat(t.format) };
  }
}
