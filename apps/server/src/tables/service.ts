import { TABLE_SEATS, makeTableCode, normalizeTableCode } from '@dozari/shared';
import type { CreateTableBody, TableError, TableView } from '@dozari/shared';

export interface TableDeps {
  profileOf(userId: string): Promise<{ nickname: string; avatarKey: string } | null>;
  startMatch(a: string, b: string): Promise<boolean>;
  inMatch(userId: string): boolean;
  idleMs(): Promise<number>;
  now?: () => number;
  rng?: () => number;
}

interface Table {
  code: string;
  name: string;
  icon: string;
  requireReady: boolean;
  locked: boolean;
  hostId: string;
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
    t.ready.delete(userId);
    this.byUser.delete(userId);
  }

  async create(hostId: string, body: CreateTableBody): Promise<TableResult<{ table: TableView }>> {
    if (this.deps.inMatch(hostId)) return { ok: false, error: 'IN_MATCH' };
    this.leaveCurrent(hostId);
    const rng = this.deps.rng ?? Math.random;
    let code = makeTableCode(rng);
    for (let i = 0; i < 20 && this.tables.has(code); i++) code = makeTableCode(rng);
    if (this.tables.has(code)) return { ok: false, error: 'BUSY' };
    const t: Table = { code, name: body.name, icon: body.icon, requireReady: body.requireReady, locked: false, hostId, seated: [hostId], ready: new Set(), expiresAt: this.now() + (await this.deps.idleMs()) };
    this.tables.set(code, t);
    this.byUser.set(hostId, code);
    return { ok: true, table: await this.view(t, hostId) };
  }

  async get(userId: string, code: string): Promise<TableView | null> {
    const t = this.live(code);
    return t ? this.view(t, userId) : null;
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
    if (this.deps.inMatch(userId)) return { ok: false, error: 'IN_MATCH' };
    if (t.locked) return { ok: false, error: 'LOCKED' };
    if (t.seated.length >= TABLE_SEATS) return { ok: false, error: 'FULL' };
    this.leaveCurrent(userId);
    t.seated.push(userId);
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
    if (t.seated.length < TABLE_SEATS) return { ok: false, error: 'NEED_PLAYERS' };
    const guest = t.seated.find((u) => u !== hostId)!;
    if (t.requireReady && !t.ready.has(guest)) return { ok: false, error: 'NOT_READY' };
    if (this.deps.inMatch(hostId) || this.deps.inMatch(guest)) return { ok: false, error: 'IN_MATCH' };
    if (!(await this.deps.startMatch(hostId, guest))) return { ok: false, error: 'START_FAILED' };
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
      players.push({ id, nickname: p.nickname, avatarKey: p.avatarKey, ready: t.ready.has(id), isHost: id === t.hostId });
    }
    return { code: t.code, name: t.name, icon: t.icon, requireReady: t.requireReady, locked: t.locked, hostId: t.hostId, youAreHost: t.hostId === forUser, youAreIn: t.seated.includes(forUser), expiresAt: t.expiresAt, inMatch: t.seated.some((u) => this.deps.inMatch(u)), players, seats: TABLE_SEATS };
  }
}
