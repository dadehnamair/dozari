import { coinLedger, eq, sql, userBalances } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';

/** A drizzle transaction handle (what `db.transaction` passes to its callback). */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface LedgerEntry {
  userId: string;
  /** Signed coins. */
  delta: number;
  reason: (typeof coinLedger.$inferInsert)['reason'];
  refType?: string;
  refId?: string;
  /** `<reason>:<refId>:<userId>` style key; applying the same key twice is a no-op. */
  idempotencyKey: string;
}

export type LedgerOutcome = { applied: true; balance: number } | { applied: false; reason: 'duplicate' | 'insufficient'; balance: number };

/**
 * The one place coins move (CLAUDE.md rule 6): append a ledger row and update the cached balance, inside the caller's
 * transaction. A key seen before changes nothing; a debit that would take the balance below zero is refused.
 */
export async function applyLedgerEntry(tx: Tx, entry: LedgerEntry): Promise<LedgerOutcome> {
  // Make sure a balance row exists, then lock it so concurrent movements for one player are serialised.
  await tx.insert(userBalances).values({ userId: entry.userId, balance: 0 }).onDuplicateKeyUpdate({ set: { userId: sql`${userBalances.userId}` } });
  const [row] = await tx.select({ balance: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, entry.userId)).for('update');
  const balance = row?.balance ?? 0;

  const [seen] = await tx.select({ id: coinLedger.id }).from(coinLedger).where(eq(coinLedger.idempotencyKey, entry.idempotencyKey)).limit(1);
  if (seen) return { applied: false, reason: 'duplicate', balance };
  if (balance + entry.delta < 0) return { applied: false, reason: 'insufficient', balance };

  await tx.insert(coinLedger).values({
    id: uuidv7(),
    userId: entry.userId,
    delta: entry.delta,
    reason: entry.reason,
    refType: entry.refType ?? null,
    refId: entry.refId ?? null,
    idempotencyKey: entry.idempotencyKey,
  });
  const next = balance + entry.delta;
  await tx.update(userBalances).set({ balance: next, updatedAt: new Date() }).where(eq(userBalances.userId, entry.userId));
  return { applied: true, balance: next };
}
