import type { FastifyInstance } from 'fastify';
import { desc, eq, gemLedger, sql, userGems } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { GemWallet } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { Tx } from './ledger.js';

export interface GemEntry {
  userId: string;
  /** Signed gems. */
  delta: number;
  reason: (typeof gemLedger.$inferInsert)['reason'];
  refType?: string;
  refId?: string;
  /** `<reason>:<refId>:<userId>` style key; applying the same key twice is a no-op. */
  idempotencyKey: string;
}

export type GemOutcome = { applied: true; balance: number } | { applied: false; reason: 'duplicate' | 'insufficient'; balance: number };

/**
 * The one place gems move (D164, the gem twin of `applyLedgerEntry`): append a ledger row and update the cached balance
 * inside the caller's transaction. A key seen before changes nothing; a debit below zero is refused.
 */
export async function applyGemEntry(tx: Tx, entry: GemEntry): Promise<GemOutcome> {
  await tx.insert(userGems).values({ userId: entry.userId, balance: 0 }).onDuplicateKeyUpdate({ set: { userId: sql`${userGems.userId}` } });
  const [row] = await tx.select({ balance: userGems.balance }).from(userGems).where(eq(userGems.userId, entry.userId)).for('update');
  const balance = row?.balance ?? 0;

  const [seen] = await tx.select({ id: gemLedger.id }).from(gemLedger).where(eq(gemLedger.idempotencyKey, entry.idempotencyKey)).limit(1);
  if (seen) return { applied: false, reason: 'duplicate', balance };
  if (balance + entry.delta < 0) return { applied: false, reason: 'insufficient', balance };

  await tx.insert(gemLedger).values({ id: uuidv7(), userId: entry.userId, delta: entry.delta, reason: entry.reason, refType: entry.refType ?? null, refId: entry.refId ?? null, idempotencyKey: entry.idempotencyKey });
  const next = balance + entry.delta;
  await tx.update(userGems).set({ balance: next, updatedAt: new Date() }).where(eq(userGems.userId, entry.userId));
  return { applied: true, balance: next };
}

/** Reads the wallet: balance (0 when the player never held gems) and the newest movements. */
export function createDbGemWallet(db: Db) {
  return {
    async wallet(userId: string, limit = 30): Promise<GemWallet> {
      const [b] = await db.select({ balance: userGems.balance }).from(userGems).where(eq(userGems.userId, userId));
      const rows = await db.select({ id: gemLedger.id, delta: gemLedger.delta, reason: gemLedger.reason, createdAt: gemLedger.createdAt }).from(gemLedger).where(eq(gemLedger.userId, userId)).orderBy(desc(gemLedger.createdAt), desc(gemLedger.id)).limit(limit);
      return { balance: b?.balance ?? 0, items: rows.map((r) => ({ id: r.id, delta: r.delta, reason: r.reason, createdAt: r.createdAt.getTime() })) };
    },
  };
}

export type GemWalletReader = ReturnType<typeof createDbGemWallet>;

export function registerGemRoutes(app: FastifyInstance, auth: AuthService, gems: Pick<GemWalletReader, 'wallet'>) {
  app.get('/me/gems', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return gems.wallet(user.id);
  });
}
