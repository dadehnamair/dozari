import { createHash, randomInt } from 'node:crypto';
import { accountDeleteCodes, eq } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { PhoneStore } from '../phone/store.js';
import type { SmsClient } from '../phone/sms.js';

export interface DeleteCodeRow {
  codeHash: string;
  attempts: number;
  sentAt: number;
  expiresAt: number;
}

/** I/O boundary of the one-time codes that guard account deletion. */
export interface DeleteCodeStore {
  get(userId: string): Promise<DeleteCodeRow | null>;
  put(userId: string, row: DeleteCodeRow): Promise<void>;
  bump(userId: string): Promise<void>;
  drop(userId: string): Promise<void>;
}

export function createDbDeleteCodeStore(db: Db): DeleteCodeStore {
  return {
    async get(userId) {
      const [r] = await db.select().from(accountDeleteCodes).where(eq(accountDeleteCodes.userId, userId));
      return r ? { codeHash: r.codeHash, attempts: r.attempts, sentAt: r.sentAt.getTime(), expiresAt: r.expiresAt.getTime() } : null;
    },
    async put(userId, row) {
      const values = { userId, codeHash: row.codeHash, attempts: row.attempts, sentAt: new Date(row.sentAt), expiresAt: new Date(row.expiresAt) };
      await db.insert(accountDeleteCodes).values(values).onDuplicateKeyUpdate({ set: values });
    },
    async bump(userId) {
      const r = await this.get(userId);
      if (r) await db.update(accountDeleteCodes).set({ attempts: r.attempts + 1 }).where(eq(accountDeleteCodes.userId, userId));
    },
    async drop(userId) {
      await db.delete(accountDeleteCodes).where(eq(accountDeleteCodes.userId, userId));
    },
  };
}

export function createMemoryDeleteCodeStore(): DeleteCodeStore {
  const rows = new Map<string, DeleteCodeRow>();
  return {
    async get(id) {
      const r = rows.get(id);
      return r ? { ...r } : null;
    },
    async put(id, row) {
      rows.set(id, { ...row });
    },
    async bump(id) {
      const r = rows.get(id);
      if (r) r.attempts += 1;
    },
    async drop(id) {
      rows.delete(id);
    },
  };
}

export type DeleteChannel = 'sms' | 'bale';
export type SendDeleteCode = { ok: true; channel: DeleteChannel } | { ok: false; error: 'no_channel' | 'too_soon' | 'send_failed'; retryAfterSec?: number };
export type ConfirmDelete = { ok: true } | { ok: false; error: 'no_code' | 'expired' | 'wrong' | 'too_many' };

const TTL_MS = 10 * 60_000;
const RESEND_MS = 60_000;
const MAX_ATTEMPTS = 5;
const hash = (code: string, userId: string) => createHash('sha256').update(`delete:${userId}:${code}`).digest('hex');

/**
 * Deleting an account asks for a fresh one-time code (owner, 2026-10-02): sent to the player's verified phone by SMS, or to their linked Bale chat.
 * A player with neither cannot receive a code, so cannot delete until they verify a phone (no silent one-tap deletion).
 */
export class AccountDeletion {
  constructor(
    private readonly store: DeleteCodeStore,
    private readonly phone: Pick<PhoneStore, 'state'>,
    private readonly sms: SmsClient | null,
    /** Queues a Bale message; false when the player has not linked Bale. */
    private readonly bale: ((userId: string, text: string) => Promise<boolean>) | null,
    private readonly now: () => number = Date.now,
    private readonly newCode: () => string = () => String(randomInt(10_000, 100_000)),
  ) {}

  async sendCode(userId: string): Promise<SendDeleteCode> {
    const old = await this.store.get(userId);
    if (old && this.now() - old.sentAt < RESEND_MS) return { ok: false, error: 'too_soon', retryAfterSec: Math.ceil((RESEND_MS - (this.now() - old.sentAt)) / 1000) };
    const code = this.newCode();
    const text = `کد حذف حساب دوزاری: ${code}\nاگر خودت درخواست نکرده‌ای، این پیام را نادیده بگیر.`;
    const { phone } = await this.phone.state(userId);
    let channel: DeleteChannel | null = null;
    try {
      if (phone && this.sms) {
        await this.sms.sendCode(phone, code);
        channel = 'sms';
      } else if (this.bale && (await this.bale(userId, text))) {
        channel = 'bale';
      }
    } catch {
      return { ok: false, error: 'send_failed' };
    }
    if (!channel) return { ok: false, error: 'no_channel' };
    await this.store.put(userId, { codeHash: hash(code, userId), attempts: 0, sentAt: this.now(), expiresAt: this.now() + TTL_MS });
    return { ok: true, channel };
  }

  /** Checks (and burns) the code; the caller deletes the account only on `ok`. */
  async confirm(userId: string, code: string): Promise<ConfirmDelete> {
    const row = await this.store.get(userId);
    if (!row) return { ok: false, error: 'no_code' };
    if (this.now() > row.expiresAt) return { ok: false, error: 'expired' };
    if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: 'too_many' };
    if (hash(code.trim(), userId) !== row.codeHash) {
      await this.store.bump(userId);
      return { ok: false, error: 'wrong' };
    }
    await this.store.drop(userId);
    return { ok: true };
  }
}
