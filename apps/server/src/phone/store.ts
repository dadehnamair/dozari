import { eq, phoneOtps, users } from '@dozari/db';
import type { Db } from '@dozari/db';

export interface PhoneState {
  /** Verified number (+989…) or null. */
  phone: string | null;
  /** Number typed in the app and waiting for verification. */
  pending: string | null;
}

export interface OtpRow {
  phone: string;
  codeHash: string;
  attempts: number;
  sentAt: number;
  expiresAt: number;
}

/** I/O boundary of phone numbers. A verified number belongs to exactly one account (unique index). */
export interface PhoneStore {
  state(userId: string): Promise<PhoneState>;
  setPending(userId: string, phone: string | null): Promise<void>;
  /** Is this number verified on a different account? */
  takenByOther(phone: string, userId: string): Promise<boolean>;
  /** Makes the number the account's verified one and clears the pending one; false if another account got there first. */
  markVerified(userId: string, phone: string, now: number): Promise<boolean>;
  clear(userId: string): Promise<void>;
  putOtp(userId: string, otp: OtpRow): Promise<void>;
  getOtp(userId: string): Promise<OtpRow | null>;
  bumpOtp(userId: string): Promise<void>;
  dropOtp(userId: string): Promise<void>;
}

export function createDbPhoneStore(db: Db): PhoneStore {
  return {
    async state(userId) {
      const [r] = await db.select({ phone: users.phone, pending: users.phonePending }).from(users).where(eq(users.id, userId));
      return { phone: r?.phone ?? null, pending: r?.pending ?? null };
    },
    async setPending(userId, phone) {
      await db.update(users).set({ phonePending: phone }).where(eq(users.id, userId));
    },
    async takenByOther(phone, userId) {
      const [r] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
      return Boolean(r && r.id !== userId);
    },
    async markVerified(userId, phone, now) {
      try {
        await db.update(users).set({ phone, phonePending: null, phoneVerifiedAt: new Date(now) }).where(eq(users.id, userId));
      } catch {
        return false; // the unique index refused: the number is already verified elsewhere
      }
      await db.delete(phoneOtps).where(eq(phoneOtps.userId, userId));
      return true;
    },
    async clear(userId) {
      await db.update(users).set({ phone: null, phonePending: null, phoneVerifiedAt: null }).where(eq(users.id, userId));
      await db.delete(phoneOtps).where(eq(phoneOtps.userId, userId));
    },
    async putOtp(userId, otp) {
      const values = { userId, phone: otp.phone, codeHash: otp.codeHash, attempts: otp.attempts, sentAt: new Date(otp.sentAt), expiresAt: new Date(otp.expiresAt) };
      await db.insert(phoneOtps).values(values).onDuplicateKeyUpdate({ set: values });
    },
    async getOtp(userId) {
      const [r] = await db.select().from(phoneOtps).where(eq(phoneOtps.userId, userId));
      return r ? { phone: r.phone, codeHash: r.codeHash, attempts: r.attempts, sentAt: r.sentAt.getTime(), expiresAt: r.expiresAt.getTime() } : null;
    },
    async bumpOtp(userId) {
      const o = await this.getOtp(userId);
      if (o) await db.update(phoneOtps).set({ attempts: o.attempts + 1 }).where(eq(phoneOtps.userId, userId));
    },
    async dropOtp(userId) {
      await db.delete(phoneOtps).where(eq(phoneOtps.userId, userId));
    },
  };
}

export function createMemoryPhoneStore(): PhoneStore & { verified: Map<string, string> } {
  const verified = new Map<string, string>();
  const pending = new Map<string, string>();
  const otps = new Map<string, OtpRow>();
  return {
    verified,
    async state(id) {
      return { phone: verified.get(id) ?? null, pending: pending.get(id) ?? null };
    },
    async setPending(id, phone) {
      if (phone === null) pending.delete(id);
      else pending.set(id, phone);
    },
    async takenByOther(phone, id) {
      return [...verified.entries()].some(([u, p]) => p === phone && u !== id);
    },
    async markVerified(id, phone) {
      if ([...verified.entries()].some(([u, p]) => p === phone && u !== id)) return false;
      verified.set(id, phone);
      pending.delete(id);
      otps.delete(id);
      return true;
    },
    async clear(id) {
      verified.delete(id);
      pending.delete(id);
      otps.delete(id);
    },
    async putOtp(id, o) {
      otps.set(id, { ...o });
    },
    async getOtp(id) {
      const o = otps.get(id);
      return o ? { ...o } : null;
    },
    async bumpOtp(id) {
      const o = otps.get(id);
      if (o) o.attempts += 1;
    },
    async dropOtp(id) {
      otps.delete(id);
    },
  };
}
