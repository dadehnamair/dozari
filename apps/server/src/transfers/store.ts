import { and, coinTransfers, desc, eq, gte, inArray, lte, or, userBalances } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';
import { applyLedgerEntry } from '../economy/ledger.js';

export type TransferKind = 'gift' | 'loan';
export type TransferStatus = 'completed' | 'offered' | 'open' | 'repaid' | 'declined' | 'cancelled';

export interface TransferRecord {
  id: string;
  kind: TransferKind;
  status: TransferStatus;
  fromUserId: string;
  toUserId: string;
  amount: number;
  repaid: number;
  dueAt: number | null;
  createdAt: number;
}

export type GiftOutcome = { ok: true; balance: number } | { ok: false; error: 'INSUFFICIENT' };
export type AcceptOutcome = 'ok' | 'not_found' | 'bad_state' | 'lender_short';
export type RepayOutcome = { ok: true; paid: number; remaining: number; balance: number } | { ok: false; error: 'not_found' | 'bad_state' };

/** I/O boundary of gifts and loans. Each money-moving call is one transaction with the coin ledger. */
export interface TransferStore {
  /** Coins this player sent in gifts and loan principals since `sinceMs` (declined and cancelled offers do not count). */
  sentSince(userId: string, sinceMs: number): Promise<number>;
  /** The sender pays `amount`; the receiver gets `amount - fee` and the fee is burned (never a coin the house keeps). */
  sendGift(from: string, to: string, amount: number, fee?: number): Promise<GiftOutcome>;
  offerLoan(from: string, to: string, amount: number): Promise<TransferRecord>;
  get(id: string): Promise<TransferRecord | null>;
  /** Loans the borrower is waiting on or owes (offered + open). */
  activeLoanCount(borrowerId: string): Promise<number>;
  /** Moves the coins from lender to borrower and starts the clock. */
  acceptLoan(id: string, borrowerId: string, dueAt: number): Promise<AcceptOutcome>;
  /** Declines (by the borrower) or cancels (by the lender) an offer that was not accepted yet. */
  closeOffer(id: string, by: string, status: 'declined' | 'cancelled'): Promise<'ok' | 'not_found' | 'bad_state'>;
  /** Pays back up to `requested` (never more than owed or than the borrower has). */
  repay(id: string, borrowerId: string, requested: number): Promise<RepayOutcome>;
  /** Open loans of this borrower whose due date has passed. */
  dueLoans(borrowerId: string, nowMs: number): Promise<TransferRecord[]>;
  list(userId: string, limit: number): Promise<TransferRecord[]>;
}

const toRecord = (r: typeof coinTransfers.$inferSelect): TransferRecord => ({
  id: r.id,
  kind: r.kind,
  status: r.status,
  fromUserId: r.fromUserId,
  toUserId: r.toUserId,
  amount: r.amount,
  repaid: r.repaid,
  dueAt: r.dueAt ? r.dueAt.getTime() : null,
  createdAt: r.createdAt.getTime(),
});

const COUNTED: TransferStatus[] = ['completed', 'offered', 'open', 'repaid'];

export function createDbTransferStore(db: Db): TransferStore {
  return {
    async sentSince(userId, sinceMs) {
      const rows = await db
        .select({ amount: coinTransfers.amount })
        .from(coinTransfers)
        .where(and(eq(coinTransfers.fromUserId, userId), gte(coinTransfers.createdAt, new Date(sinceMs)), inArray(coinTransfers.status, COUNTED)));
      return rows.reduce((n, r) => n + r.amount, 0);
    },
    async sendGift(from, to, amount, fee = 0) {
      return db.transaction(async (tx): Promise<GiftOutcome> => {
        const id = uuidv7();
        const out = await applyLedgerEntry(tx, { userId: from, delta: -amount, reason: 'gift_out', refType: 'transfer', refId: id, idempotencyKey: `gift_out:${id}:${from}` });
        if (!out.applied) return { ok: false, error: 'INSUFFICIENT' };
        await applyLedgerEntry(tx, { userId: to, delta: amount - fee, reason: 'gift_in', refType: 'transfer', refId: id, idempotencyKey: `gift_in:${id}:${to}` });
        await tx.insert(coinTransfers).values({ id, kind: 'gift', status: 'completed', fromUserId: from, toUserId: to, amount, closedAt: new Date() });
        return { ok: true, balance: out.balance };
      });
    },
    async offerLoan(from, to, amount) {
      const id = uuidv7();
      await db.insert(coinTransfers).values({ id, kind: 'loan', status: 'offered', fromUserId: from, toUserId: to, amount });
      const [r] = await db.select().from(coinTransfers).where(eq(coinTransfers.id, id));
      return toRecord(r!);
    },
    async get(id) {
      const [r] = await db.select().from(coinTransfers).where(eq(coinTransfers.id, id));
      return r ? toRecord(r) : null;
    },
    async activeLoanCount(borrowerId) {
      const rows = await db.select({ id: coinTransfers.id }).from(coinTransfers).where(and(eq(coinTransfers.toUserId, borrowerId), eq(coinTransfers.kind, 'loan'), inArray(coinTransfers.status, ['offered', 'open'])));
      return rows.length;
    },
    async acceptLoan(id, borrowerId, dueAt) {
      return db.transaction(async (tx): Promise<AcceptOutcome> => {
        const [r] = await tx.select().from(coinTransfers).where(and(eq(coinTransfers.id, id), eq(coinTransfers.toUserId, borrowerId), eq(coinTransfers.kind, 'loan'))).for('update');
        if (!r) return 'not_found';
        if (r.status !== 'offered') return 'bad_state';
        const out = await applyLedgerEntry(tx, { userId: r.fromUserId, delta: -r.amount, reason: 'loan_out', refType: 'transfer', refId: id, idempotencyKey: `loan_out:${id}:${r.fromUserId}` });
        if (!out.applied) return 'lender_short';
        await applyLedgerEntry(tx, { userId: borrowerId, delta: r.amount, reason: 'loan_in', refType: 'transfer', refId: id, idempotencyKey: `loan_in:${id}:${borrowerId}` });
        await tx.update(coinTransfers).set({ status: 'open', dueAt: new Date(dueAt) }).where(eq(coinTransfers.id, id));
        return 'ok';
      });
    },
    async closeOffer(id, by, status) {
      return db.transaction(async (tx) => {
        const who = status === 'declined' ? coinTransfers.toUserId : coinTransfers.fromUserId;
        const [r] = await tx.select().from(coinTransfers).where(and(eq(coinTransfers.id, id), eq(who, by), eq(coinTransfers.kind, 'loan'))).for('update');
        if (!r) return 'not_found';
        if (r.status !== 'offered') return 'bad_state';
        await tx.update(coinTransfers).set({ status, closedAt: new Date() }).where(eq(coinTransfers.id, id));
        return 'ok';
      });
    },
    async repay(id, borrowerId, requested) {
      return db.transaction(async (tx): Promise<RepayOutcome> => {
        const [r] = await tx.select().from(coinTransfers).where(and(eq(coinTransfers.id, id), eq(coinTransfers.toUserId, borrowerId), eq(coinTransfers.kind, 'loan'))).for('update');
        if (!r) return { ok: false, error: 'not_found' };
        if (r.status !== 'open') return { ok: false, error: 'bad_state' };
        await tx.insert(userBalances).values({ userId: borrowerId, balance: 0 }).onDuplicateKeyUpdate({ set: { userId: borrowerId } });
        const [bal] = await tx.select({ balance: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, borrowerId)).for('update');
        const owed = r.amount - r.repaid;
        const pay = Math.max(0, Math.min(requested, owed, bal?.balance ?? 0));
        if (pay === 0) return { ok: true, paid: 0, remaining: owed, balance: bal?.balance ?? 0 };
        const step = `${id}:${r.repaid}`;
        const out = await applyLedgerEntry(tx, { userId: borrowerId, delta: -pay, reason: 'repay_out', refType: 'transfer', refId: id, idempotencyKey: `repay_out:${step}:${borrowerId}` });
        await applyLedgerEntry(tx, { userId: r.fromUserId, delta: pay, reason: 'repay_in', refType: 'transfer', refId: id, idempotencyKey: `repay_in:${step}:${r.fromUserId}` });
        const repaid = r.repaid + pay;
        await tx.update(coinTransfers).set(repaid >= r.amount ? { repaid, status: 'repaid', closedAt: new Date() } : { repaid }).where(eq(coinTransfers.id, id));
        return { ok: true, paid: pay, remaining: r.amount - repaid, balance: out.balance };
      });
    },
    async dueLoans(borrowerId, nowMs) {
      const rows = await db.select().from(coinTransfers).where(and(eq(coinTransfers.toUserId, borrowerId), eq(coinTransfers.kind, 'loan'), eq(coinTransfers.status, 'open'), lte(coinTransfers.dueAt, new Date(nowMs))));
      return rows.map(toRecord);
    },
    async list(userId, limit) {
      const rows = await db.select().from(coinTransfers).where(or(eq(coinTransfers.fromUserId, userId), eq(coinTransfers.toUserId, userId))).orderBy(desc(coinTransfers.createdAt)).limit(limit);
      return rows.map(toRecord);
    },
  };
}

/** Memory store for tests, with a tiny coin ledger. `now` drives created-at times. */
export function createMemoryTransferStore(): TransferStore & { coins: Map<string, number>; now: { ms: number } } {
  const rows: TransferRecord[] = [];
  const coins = new Map<string, number>();
  const now = { ms: Date.now() };
  const bal = (id: string) => coins.get(id) ?? 0;
  const add = (id: string, n: number) => coins.set(id, bal(id) + n);
  let seq = 0;
  const newId = () => `00000000-0000-7000-8000-${String(++seq).padStart(12, '0')}`;
  return {
    coins,
    now,
    async sentSince(userId, since) {
      return rows.filter((r) => r.fromUserId === userId && r.createdAt >= since && COUNTED.includes(r.status)).reduce((n, r) => n + r.amount, 0);
    },
    async sendGift(from, to, amount, fee = 0) {
      if (bal(from) < amount) return { ok: false, error: 'INSUFFICIENT' };
      add(from, -amount);
      add(to, amount - fee);
      rows.push({ id: newId(), kind: 'gift', status: 'completed', fromUserId: from, toUserId: to, amount, repaid: 0, dueAt: null, createdAt: now.ms });
      return { ok: true, balance: bal(from) };
    },
    async offerLoan(from, to, amount) {
      const r: TransferRecord = { id: newId(), kind: 'loan', status: 'offered', fromUserId: from, toUserId: to, amount, repaid: 0, dueAt: null, createdAt: now.ms };
      rows.push(r);
      return { ...r };
    },
    async get(id) {
      const r = rows.find((x) => x.id === id);
      return r ? { ...r } : null;
    },
    async activeLoanCount(b) {
      return rows.filter((r) => r.toUserId === b && r.kind === 'loan' && (r.status === 'offered' || r.status === 'open')).length;
    },
    async acceptLoan(id, b, dueAt) {
      const r = rows.find((x) => x.id === id && x.toUserId === b && x.kind === 'loan');
      if (!r) return 'not_found';
      if (r.status !== 'offered') return 'bad_state';
      if (bal(r.fromUserId) < r.amount) return 'lender_short';
      add(r.fromUserId, -r.amount);
      add(b, r.amount);
      r.status = 'open';
      r.dueAt = dueAt;
      return 'ok';
    },
    async closeOffer(id, by, status) {
      const r = rows.find((x) => x.id === id && x.kind === 'loan' && (status === 'declined' ? x.toUserId : x.fromUserId) === by);
      if (!r) return 'not_found';
      if (r.status !== 'offered') return 'bad_state';
      r.status = status;
      return 'ok';
    },
    async repay(id, b, requested) {
      const r = rows.find((x) => x.id === id && x.toUserId === b && x.kind === 'loan');
      if (!r) return { ok: false, error: 'not_found' };
      if (r.status !== 'open') return { ok: false, error: 'bad_state' };
      const pay = Math.max(0, Math.min(requested, r.amount - r.repaid, bal(b)));
      add(b, -pay);
      add(r.fromUserId, pay);
      r.repaid += pay;
      if (r.repaid >= r.amount) r.status = 'repaid';
      return { ok: true, paid: pay, remaining: r.amount - r.repaid, balance: bal(b) };
    },
    async dueLoans(b, nowMs) {
      return rows.filter((r) => r.toUserId === b && r.kind === 'loan' && r.status === 'open' && r.dueAt !== null && r.dueAt <= nowMs).map((r) => ({ ...r }));
    },
    async list(userId, limit) {
      return rows.filter((r) => r.fromUserId === userId || r.toUserId === userId).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map((r) => ({ ...r }));
    },
  };
}
