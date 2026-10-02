import { and, asc, desc, eq, inArray, tournamentEntries, tournamentMatches, tournamentPrizes, tournaments, userBalances } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';
import { applyLedgerEntry } from '../economy/ledger.js';

export type TournamentStatus = 'draft' | 'open' | 'running' | 'finished' | 'cancelled';
export type MatchStatus = 'waiting' | 'ready' | 'playing' | 'done' | 'bye';

export interface TournamentRow {
  id: string;
  titleFa: string;
  descriptionFa: string;
  iconKey: string | null;
  status: TournamentStatus;
  size: number;
  minPlayers: number;
  entryCoins: number;
  minLevel: number;
  startsAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}
export type NewTournament = Omit<TournamentRow, 'id' | 'startedAt' | 'finishedAt'>;

export interface MatchRow {
  id: string;
  tournamentId: string;
  round: number;
  slot: number;
  a: string | null;
  b: string | null;
  winner: string | null;
  status: MatchStatus;
}

export interface EntryRow {
  userId: string;
  joinedAt: number;
  paid: number;
}

export type JoinOutcome = 'ok' | 'full' | 'already' | 'insufficient' | 'closed';

/** I/O boundary of tournaments. Coin movements (entry, refund, prize) go through the ledger inside one transaction. */
export interface TournamentStore {
  create(t: NewTournament, prizes: readonly { place: number; coins: number }[]): Promise<TournamentRow>;
  update(id: string, patch: Partial<NewTournament> & { startedAt?: number | null; finishedAt?: number | null }): Promise<'ok' | 'not_found'>;
  get(id: string): Promise<TournamentRow | null>;
  list(statuses: readonly TournamentStatus[], limit: number): Promise<TournamentRow[]>;
  prizes(id: string): Promise<{ place: number; coins: number }[]>;
  setPrizes(id: string, prizes: readonly { place: number; coins: number }[]): Promise<void>;
  entries(id: string): Promise<EntryRow[]>;
  entriesOf(userId: string, ids: readonly string[]): Promise<Set<string>>;
  join(id: string, userId: string, fee: number, nowMs: number): Promise<JoinOutcome>;
  /** Leaves an open tournament and gets the fee back. */
  leave(id: string, userId: string): Promise<'ok' | 'not_in' | 'closed'>;
  /** Cancels: refunds every entry and marks the tournament cancelled. */
  cancel(id: string): Promise<number>;
  setMatches(id: string, rows: readonly Omit<MatchRow, 'id' | 'tournamentId'>[]): Promise<void>;
  matches(id: string): Promise<MatchRow[]>;
  updateMatch(matchId: string, patch: Partial<Pick<MatchRow, 'a' | 'b' | 'winner' | 'status'>>): Promise<void>;
  /** Players of the `playing` match between `a` and `b`, if any. */
  findPlaying(a: string, b: string): Promise<(MatchRow & { tournament: TournamentRow }) | null>;
  payout(id: string, awards: readonly { userId: string; coins: number }[]): Promise<void>;
  balance(userId: string): Promise<number>;
}

const toRow = (r: typeof tournaments.$inferSelect): TournamentRow => ({
  id: r.id,
  titleFa: r.titleFa,
  descriptionFa: r.descriptionFa,
  iconKey: r.iconKey,
  status: r.status,
  size: r.size,
  minPlayers: r.minPlayers,
  entryCoins: r.entryCoins,
  minLevel: r.minLevel,
  startsAt: r.startsAt.getTime(),
  startedAt: r.startedAt ? r.startedAt.getTime() : null,
  finishedAt: r.finishedAt ? r.finishedAt.getTime() : null,
});
const toMatch = (r: typeof tournamentMatches.$inferSelect): MatchRow => ({ id: r.id, tournamentId: r.tournamentId, round: r.round, slot: r.slot, a: r.playerA, b: r.playerB, winner: r.winnerId, status: r.status });

export function createDbTournamentStore(db: Db): TournamentStore {
  return {
    async create(t, prizes) {
      const id = uuidv7();
      await db.insert(tournaments).values({ id, titleFa: t.titleFa, descriptionFa: t.descriptionFa, iconKey: t.iconKey, status: t.status, size: t.size, minPlayers: t.minPlayers, entryCoins: t.entryCoins, minLevel: t.minLevel, startsAt: new Date(t.startsAt) });
      if (prizes.length > 0) await db.insert(tournamentPrizes).values(prizes.map((p) => ({ tournamentId: id, place: p.place, coins: p.coins })));
      const [r] = await db.select().from(tournaments).where(eq(tournaments.id, id));
      return toRow(r!);
    },
    async update(id, patch) {
      const [r] = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, id));
      if (!r) return 'not_found';
      const { startsAt, startedAt, finishedAt, ...rest } = patch;
      await db.update(tournaments).set({ ...rest, ...(startsAt !== undefined ? { startsAt: new Date(startsAt) } : {}), ...(startedAt !== undefined ? { startedAt: startedAt === null ? null : new Date(startedAt) } : {}), ...(finishedAt !== undefined ? { finishedAt: finishedAt === null ? null : new Date(finishedAt) } : {}) }).where(eq(tournaments.id, id));
      return 'ok';
    },
    async get(id) {
      const [r] = await db.select().from(tournaments).where(eq(tournaments.id, id));
      return r ? toRow(r) : null;
    },
    async list(statuses, limit) {
      return (await db.select().from(tournaments).where(inArray(tournaments.status, [...statuses])).orderBy(desc(tournaments.startsAt)).limit(limit)).map(toRow);
    },
    async prizes(id) {
      return (await db.select().from(tournamentPrizes).where(eq(tournamentPrizes.tournamentId, id)).orderBy(asc(tournamentPrizes.place))).map((p) => ({ place: p.place, coins: p.coins }));
    },
    async setPrizes(id, prizes) {
      await db.transaction(async (tx) => {
        await tx.delete(tournamentPrizes).where(eq(tournamentPrizes.tournamentId, id));
        if (prizes.length > 0) await tx.insert(tournamentPrizes).values(prizes.map((p) => ({ tournamentId: id, place: p.place, coins: p.coins })));
      });
    },
    async entries(id) {
      return (await db.select().from(tournamentEntries).where(eq(tournamentEntries.tournamentId, id)).orderBy(asc(tournamentEntries.joinedAt))).map((e) => ({ userId: e.userId, joinedAt: e.joinedAt.getTime(), paid: e.paid }));
    },
    async entriesOf(userId, ids) {
      if (ids.length === 0) return new Set();
      const rows = await db.select({ t: tournamentEntries.tournamentId }).from(tournamentEntries).where(and(eq(tournamentEntries.userId, userId), inArray(tournamentEntries.tournamentId, [...ids])));
      return new Set(rows.map((r) => r.t));
    },
    async join(id, userId, fee, nowMs) {
      return db.transaction(async (tx): Promise<JoinOutcome> => {
        const [t] = await tx.select().from(tournaments).where(eq(tournaments.id, id)).for('update');
        if (!t || t.status !== 'open') return 'closed';
        const have = await tx.select({ u: tournamentEntries.userId }).from(tournamentEntries).where(eq(tournamentEntries.tournamentId, id));
        if (have.some((h) => h.u === userId)) return 'already';
        if (have.length >= t.size) return 'full';
        if (fee > 0) {
          const out = await applyLedgerEntry(tx, { userId, delta: -fee, reason: 'tournament_entry', refType: 'tournament', refId: id, idempotencyKey: `tournament_entry:${id}:${userId}:${nowMs}` });
          if (!out.applied) return 'insufficient';
        }
        await tx.insert(tournamentEntries).values({ tournamentId: id, userId, joinedAt: new Date(nowMs), paid: fee });
        return 'ok';
      });
    },
    async leave(id, userId) {
      return db.transaction(async (tx) => {
        const [t] = await tx.select().from(tournaments).where(eq(tournaments.id, id)).for('update');
        if (!t || t.status !== 'open') return 'closed';
        const [e] = await tx.select().from(tournamentEntries).where(and(eq(tournamentEntries.tournamentId, id), eq(tournamentEntries.userId, userId)));
        if (!e) return 'not_in';
        if (e.paid > 0) await applyLedgerEntry(tx, { userId, delta: e.paid, reason: 'tournament_refund', refType: 'tournament', refId: id, idempotencyKey: `tournament_refund:${id}:${userId}:${e.joinedAt.getTime()}` });
        await tx.delete(tournamentEntries).where(and(eq(tournamentEntries.tournamentId, id), eq(tournamentEntries.userId, userId)));
        return 'ok';
      });
    },
    async cancel(id) {
      return db.transaction(async (tx) => {
        const entries = await tx.select().from(tournamentEntries).where(eq(tournamentEntries.tournamentId, id));
        for (const e of entries) if (e.paid > 0) await applyLedgerEntry(tx, { userId: e.userId, delta: e.paid, reason: 'tournament_refund', refType: 'tournament', refId: id, idempotencyKey: `tournament_refund:${id}:${e.userId}:${e.joinedAt.getTime()}` });
        await tx.update(tournaments).set({ status: 'cancelled', finishedAt: new Date() }).where(eq(tournaments.id, id));
        return entries.length;
      });
    },
    async setMatches(id, rows) {
      await db.transaction(async (tx) => {
        await tx.delete(tournamentMatches).where(eq(tournamentMatches.tournamentId, id));
        if (rows.length > 0) await tx.insert(tournamentMatches).values(rows.map((r) => ({ id: uuidv7(), tournamentId: id, round: r.round, slot: r.slot, playerA: r.a, playerB: r.b, winnerId: r.winner, status: r.status })));
      });
    },
    async matches(id) {
      return (await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, id)).orderBy(asc(tournamentMatches.round), asc(tournamentMatches.slot))).map(toMatch);
    },
    async updateMatch(matchId, patch) {
      await db.update(tournamentMatches).set({ ...(patch.a !== undefined ? { playerA: patch.a } : {}), ...(patch.b !== undefined ? { playerB: patch.b } : {}), ...(patch.winner !== undefined ? { winnerId: patch.winner } : {}), ...(patch.status !== undefined ? { status: patch.status } : {}) }).where(eq(tournamentMatches.id, matchId));
    },
    async findPlaying(a, b) {
      const rows = await db.select({ m: tournamentMatches, t: tournaments }).from(tournamentMatches).innerJoin(tournaments, eq(tournaments.id, tournamentMatches.tournamentId)).where(and(eq(tournamentMatches.status, 'playing'), eq(tournaments.status, 'running')));
      const hit = rows.find(({ m }) => (m.playerA === a && m.playerB === b) || (m.playerA === b && m.playerB === a));
      return hit ? { ...toMatch(hit.m), tournament: toRow(hit.t) } : null;
    },
    async payout(id, awards) {
      await db.transaction(async (tx) => {
        for (const w of awards) if (w.coins > 0) await applyLedgerEntry(tx, { userId: w.userId, delta: w.coins, reason: 'tournament_prize', refType: 'tournament', refId: id, idempotencyKey: `tournament_prize:${id}:${w.userId}` });
      });
    },
    async balance(userId) {
      const [b] = await db.select({ balance: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId));
      return b?.balance ?? 0;
    },
  };
}


/** Memory store for tests: a tiny coin ledger and the same rules. */
export function createMemoryTournamentStore(): TournamentStore & { coins: Map<string, number> } {
  const ts = new Map<string, TournamentRow>();
  const prizes = new Map<string, { place: number; coins: number }[]>();
  const entries = new Map<string, EntryRow[]>();
  const matches = new Map<string, MatchRow[]>();
  const coins = new Map<string, number>();
  const paidOut = new Set<string>();
  let seq = 0;
  const id = () => `00000000-0000-7000-b000-${String(++seq).padStart(12, '0')}`;
  const bal = (u: string) => coins.get(u) ?? 0;
  return {
    coins,
    async create(t, p) {
      const row: TournamentRow = { ...t, id: id(), startedAt: null, finishedAt: null };
      ts.set(row.id, row);
      prizes.set(row.id, p.map((x) => ({ ...x })));
      entries.set(row.id, []);
      matches.set(row.id, []);
      return { ...row };
    },
    async update(tid, patch) {
      const r = ts.get(tid);
      if (!r) return 'not_found';
      Object.assign(r, patch);
      return 'ok';
    },
    async get(tid) {
      const r = ts.get(tid);
      return r ? { ...r } : null;
    },
    async list(statuses, limit) {
      return [...ts.values()].filter((t) => statuses.includes(t.status)).sort((a, b) => b.startsAt - a.startsAt).slice(0, limit).map((t) => ({ ...t }));
    },
    async prizes(tid) {
      return [...(prizes.get(tid) ?? [])].sort((a, b) => a.place - b.place);
    },
    async setPrizes(tid, p) {
      prizes.set(tid, p.map((x) => ({ ...x })));
    },
    async entries(tid) {
      return (entries.get(tid) ?? []).map((e) => ({ ...e }));
    },
    async entriesOf(u, ids) {
      return new Set(ids.filter((t) => (entries.get(t) ?? []).some((e) => e.userId === u)));
    },
    async join(tid, u, fee, now) {
      const t = ts.get(tid);
      if (!t || t.status !== 'open') return 'closed';
      const list = entries.get(tid)!;
      if (list.some((e) => e.userId === u)) return 'already';
      if (list.length >= t.size) return 'full';
      if (fee > 0) {
        if (bal(u) < fee) return 'insufficient';
        coins.set(u, bal(u) - fee);
      }
      list.push({ userId: u, joinedAt: now, paid: fee });
      return 'ok';
    },
    async leave(tid, u) {
      const t = ts.get(tid);
      if (!t || t.status !== 'open') return 'closed';
      const list = entries.get(tid)!;
      const i = list.findIndex((e) => e.userId === u);
      if (i < 0) return 'not_in';
      coins.set(u, bal(u) + list[i]!.paid);
      list.splice(i, 1);
      return 'ok';
    },
    async cancel(tid) {
      const list = entries.get(tid) ?? [];
      for (const e of list) coins.set(e.userId, bal(e.userId) + e.paid);
      const t = ts.get(tid);
      if (t) t.status = 'cancelled';
      return list.length;
    },
    async setMatches(tid, rows) {
      matches.set(tid, rows.map((r) => ({ ...r, id: id(), tournamentId: tid })));
    },
    async matches(tid) {
      return (matches.get(tid) ?? []).map((m) => ({ ...m })).sort((a, b) => a.round - b.round || a.slot - b.slot);
    },
    async updateMatch(mid, patch) {
      for (const list of matches.values()) {
        const m = list.find((x) => x.id === mid);
        if (m) Object.assign(m, patch);
      }
    },
    async findPlaying(a, b) {
      for (const [tid, list] of matches) {
        const t = ts.get(tid);
        const m = list.find((x) => x.status === 'playing' && ((x.a === a && x.b === b) || (x.a === b && x.b === a)));
        if (m && t && t.status === 'running') return { ...m, tournament: { ...t } };
      }
      return null;
    },
    async payout(tid, awards) {
      for (const w of awards) {
        const key = `${tid}:${w.userId}`;
        if (w.coins > 0 && !paidOut.has(key)) {
          paidOut.add(key);
          coins.set(w.userId, bal(w.userId) + w.coins);
        }
      }
    },
    async balance(u) {
      return bal(u);
    },
  };
}
