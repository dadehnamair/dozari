import { and, desc, eq, inviteCodes, inviteRedemptions, isNull, userBalances, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import { applyLedgerEntry } from '../economy/ledger.js';

export interface InviteCodeRow {
  code: string;
  ownerId: string | null;
  label: string | null;
  maxUses: number;
  uses: number;
  isActive: boolean;
}

export type RedeemOutcome = { ok: true; bonus: number; balance: number } | { ok: false; error: 'invalid' | 'own_code' | 'already_redeemed' | 'exhausted' | 'inactive' };

/** I/O boundary of invite codes. Redeeming and paying the inviter are each one transaction with the coin ledger. */
export interface InviteStore {
  ownCode(userId: string): Promise<InviteCodeRow | null>;
  /** 'taken' when the code text or the owner already has one (the caller retries with another code). */
  createCode(code: string, ownerId: string | null, label: string | null, maxUses: number): Promise<InviteCodeRow | 'taken'>;
  /** A player redeems a code exactly once, ever: the code gains a use, the player is activated and gets the bonus. */
  redeem(inviteeId: string, code: string, bonus: number): Promise<RedeemOutcome>;
  /** Pays the inviter of this player once; false when there is nothing to pay (no inviter, or already paid). */
  payInviter(inviteeId: string, reward: number): Promise<boolean>;
  isActivated(userId: string): Promise<boolean>;
  /** How many players this player invited whose reward was paid / is still waiting. */
  counts(inviterId: string): Promise<{ rewarded: number; pending: number }>;
  listCodes(): Promise<InviteCodeRow[]>;
  updateCode(code: string, patch: { maxUses?: number; isActive?: boolean }): Promise<'ok' | 'not_found'>;
}

const toRow = (r: typeof inviteCodes.$inferSelect): InviteCodeRow => ({ code: r.code, ownerId: r.ownerId, label: r.label, maxUses: r.maxUses, uses: r.uses, isActive: r.isActive });

export function createDbInviteStore(db: Db): InviteStore {
  return {
    async ownCode(userId) {
      const [r] = await db.select().from(inviteCodes).where(eq(inviteCodes.ownerId, userId));
      return r ? toRow(r) : null;
    },
    async createCode(code, ownerId, label, maxUses) {
      try {
        await db.insert(inviteCodes).values({ code, ownerId, label, maxUses });
      } catch {
        return 'taken';
      }
      return { code, ownerId, label, maxUses, uses: 0, isActive: true };
    },
    async redeem(inviteeId, code, bonus) {
      class Refused extends Error {
        constructor(readonly why: Extract<RedeemOutcome, { ok: false }>['error']) {
          super(why);
        }
      }
      try {
        return await db.transaction(async (tx): Promise<RedeemOutcome> => {
          const [row] = await tx.select().from(inviteCodes).where(eq(inviteCodes.code, code)).for('update');
          if (!row) throw new Refused('invalid');
          if (row.ownerId === inviteeId) throw new Refused('own_code');
          if (!row.isActive) throw new Refused('inactive');
          if (row.uses >= row.maxUses) throw new Refused('exhausted');
          if (row.ownerId) {
            const [owner] = await tx.select({ banned: users.isBanned }).from(users).where(eq(users.id, row.ownerId));
            if (!owner || owner.banned) throw new Refused('inactive');
          }
          const [done] = await tx.select({ id: inviteRedemptions.inviteeId }).from(inviteRedemptions).where(eq(inviteRedemptions.inviteeId, inviteeId)).for('update');
          if (done) throw new Refused('already_redeemed');
          await tx.insert(inviteRedemptions).values({ inviteeId, code, inviterId: row.ownerId });
          await tx.update(inviteCodes).set({ uses: row.uses + 1 }).where(eq(inviteCodes.code, code));
          await tx.update(users).set({ chatUnlockedAt: new Date() }).where(eq(users.id, inviteeId));
          let balance = 0;
          if (bonus > 0) {
            const ledger = await applyLedgerEntry(tx, { userId: inviteeId, delta: bonus, reason: 'invite_reward', refType: 'invite_code', refId: code, idempotencyKey: `invite_bonus:${inviteeId}` });
            balance = ledger.balance;
          } else {
            const [b] = await tx.select({ balance: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, inviteeId));
            balance = b?.balance ?? 0;
          }
          return { ok: true, bonus, balance };
        });
      } catch (e) {
        if (e instanceof Refused) return { ok: false, error: e.why };
        throw e;
      }
    },
    async payInviter(inviteeId, reward) {
      return db.transaction(async (tx) => {
        const [r] = await tx.select().from(inviteRedemptions).where(and(eq(inviteRedemptions.inviteeId, inviteeId), isNull(inviteRedemptions.rewardPaidAt))).for('update');
        if (!r || !r.inviterId) return false;
        if (reward > 0) await applyLedgerEntry(tx, { userId: r.inviterId, delta: reward, reason: 'invite_reward', refType: 'invite_redemption', refId: inviteeId, idempotencyKey: `invite_reward:${inviteeId}:${r.inviterId}` });
        await tx.update(inviteRedemptions).set({ rewardPaidAt: new Date() }).where(eq(inviteRedemptions.inviteeId, inviteeId));
        return true;
      });
    },
    async isActivated(userId) {
      const [r] = await db.select({ at: users.chatUnlockedAt }).from(users).where(eq(users.id, userId));
      return Boolean(r?.at);
    },
    async counts(inviterId) {
      const rows = await db.select({ paid: inviteRedemptions.rewardPaidAt }).from(inviteRedemptions).where(eq(inviteRedemptions.inviterId, inviterId));
      const rewarded = rows.filter((r) => r.paid !== null).length;
      return { rewarded, pending: rows.length - rewarded };
    },
    async listCodes() {
      return (await db.select().from(inviteCodes).orderBy(desc(inviteCodes.createdAt)).limit(500)).map(toRow);
    },
    async updateCode(code, patch) {
      const [r] = await db.select({ code: inviteCodes.code }).from(inviteCodes).where(eq(inviteCodes.code, code));
      if (!r) return 'not_found';
      await db.update(inviteCodes).set(patch).where(eq(inviteCodes.code, code));
      return 'ok';
    },
  };
}

/** Memory store for tests, with a tiny coin ledger and a ban list. */
export function createMemoryInviteStore(): InviteStore & { coins: Map<string, number>; banned: Set<string>; activated: Set<string> } {
  const codes = new Map<string, InviteCodeRow>();
  const redemptions = new Map<string, { code: string; inviterId: string | null; paid: boolean }>();
  const coins = new Map<string, number>();
  const banned = new Set<string>();
  const activated = new Set<string>();
  const add = (id: string, n: number) => coins.set(id, (coins.get(id) ?? 0) + n);
  return {
    coins,
    banned,
    activated,
    async ownCode(userId) {
      return [...codes.values()].find((c) => c.ownerId === userId) ?? null;
    },
    async createCode(code, ownerId, label, maxUses) {
      if (codes.has(code) || (ownerId && [...codes.values()].some((c) => c.ownerId === ownerId))) return 'taken';
      const row = { code, ownerId, label, maxUses, uses: 0, isActive: true };
      codes.set(code, row);
      return { ...row };
    },
    async redeem(inviteeId, code, bonus) {
      const row = codes.get(code);
      if (!row) return { ok: false, error: 'invalid' };
      if (row.ownerId === inviteeId) return { ok: false, error: 'own_code' };
      if (!row.isActive || (row.ownerId && banned.has(row.ownerId))) return { ok: false, error: 'inactive' };
      if (row.uses >= row.maxUses) return { ok: false, error: 'exhausted' };
      if (redemptions.has(inviteeId)) return { ok: false, error: 'already_redeemed' };
      redemptions.set(inviteeId, { code, inviterId: row.ownerId, paid: false });
      row.uses += 1;
      activated.add(inviteeId);
      add(inviteeId, bonus);
      return { ok: true, bonus, balance: coins.get(inviteeId) ?? 0 };
    },
    async payInviter(inviteeId, reward) {
      const r = redemptions.get(inviteeId);
      if (!r || !r.inviterId || r.paid) return false;
      r.paid = true;
      add(r.inviterId, reward);
      return true;
    },
    async isActivated(userId) {
      return activated.has(userId);
    },
    async counts(inviterId) {
      const mine = [...redemptions.values()].filter((r) => r.inviterId === inviterId);
      return { rewarded: mine.filter((r) => r.paid).length, pending: mine.filter((r) => !r.paid).length };
    },
    async listCodes() {
      return [...codes.values()].map((c) => ({ ...c }));
    },
    async updateCode(code, patch) {
      const r = codes.get(code);
      if (!r) return 'not_found';
      Object.assign(r, patch);
      return 'ok';
    },
  };
}

