import { createHash, randomInt } from 'node:crypto';
import { maskPhone, normalizeIranPhone } from '@dozari/shared';
import type { AccountSummary, PhoneChoice, PhoneConflict } from '@dozari/shared';
import type { SettingsService } from '../settings/service.js';
import { RateLimiter } from '../security/rate-limit.js';
import type { PhoneStore } from './store.js';
import { smsReady } from './sms.js';
import type { SmsClient } from './sms.js';
import { smsErrorCode } from './sms-errors.js';

export interface PhoneRules {
  smsTtlMs: number;
  smsResendMs: number;
}

export async function phoneRulesFromSettings(settings: SettingsService): Promise<PhoneRules> {
  const [ttl, resend] = await Promise.all([settings.num('phone.sms_ttl_minutes'), settings.num('phone.sms_resend_seconds')]);
  return { smsTtlMs: ttl! * 60_000, smsResendMs: resend! * 1000 };
}

export interface PhoneStatus {
  /** Masked verified number. */
  phone: string | null;
  /** Masked number waiting for verification. */
  pending: string | null;
  verified: boolean;
  smsAvailable: boolean;
  /** A proven number waits for the player to choose which account keeps it. */
  conflict: PhoneConflict | null;
}

export type SetPhoneResult = { ok: true; status: PhoneStatus } | { ok: false; error: 'invalid_phone' | 'taken' | 'rate_limited' };
export type ContactResult = 'verified' | 'mismatch' | 'taken' | 'no_pending' | 'already' | 'conflict';
export type ResolveResult = { ok: true; switchTo: string | null } | { ok: false; error: 'no_conflict' };
export type SmsSendResult = { ok: true } | { ok: false; error: 'no_pending' | 'sms_unavailable' | 'too_soon' | 'send_failed' | (string & {}); retryAfterSec?: number };
export type SmsVerifyResult = { ok: true } | { ok: false; error: 'no_code' | 'expired' | 'wrong' | 'too_many' | 'taken' };

const MAX_OTP_ATTEMPTS = 5;
const CONFLICT_TTL_MS = 30 * 60_000;
const hash = (code: string, userId: string) => createHash('sha256').update(`${userId}:${code}`).digest('hex');

/** Mobile numbers: typed in the app, proven by sharing the Bale contact or by an SMS code. */
export class PhoneService {
  /** Typing numbers is how someone tries to claim another person's: 5 changes per hour per player. */
  private readonly changes = new RateLimiter(5, 60 * 60_000);

  constructor(
    private readonly store: PhoneStore,
    private readonly rules: () => Promise<PhoneRules>,
    private readonly sms: SmsClient | null,
    private readonly now: () => number = Date.now,
    private readonly newCode: () => string = () => String(randomInt(10_000, 100_000)),
    /** Level, coins and name of an account, for the choice screen; without it every account reads as level 1 with no coins. */
    private readonly summaryOf: (userId: string) => Promise<AccountSummary> = async () => ({ nickname: '', avatarKey: 'avatar-01', level: 1, coins: 0 }),
  ) {}

  async status(userId: string): Promise<PhoneStatus> {
    const s = await this.store.state(userId);
    return { phone: s.phone ? maskPhone(s.phone) : null, pending: s.pending ? maskPhone(s.pending) : null, verified: s.phone !== null, smsAvailable: smsReady(this.sms), conflict: await this.openConflict(userId) };
  }

  /** The waiting choice, or null; a stale one (expired, or the old account lost the number meanwhile) is dropped. */
  private async openConflict(userId: string): Promise<PhoneConflict | null> {
    const c = await this.store.getConflict(userId);
    if (!c) return null;
    if (this.now() - c.createdAt > CONFLICT_TTL_MS || (await this.store.holderOf(c.phone)) !== c.holderId) {
      await this.store.dropConflict(userId);
      return null;
    }
    const [current, previous] = await Promise.all([this.summaryOf(userId), this.summaryOf(c.holderId)]);
    return { phone: maskPhone(c.phone), current, previous };
  }

  /** The player's answer: keep the number on this account, or load the previous account (the caller then issues its session). */
  async resolve(userId: string, choice: PhoneChoice): Promise<ResolveResult> {
    const c = await this.store.getConflict(userId);
    if (!c || this.now() - c.createdAt > CONFLICT_TTL_MS) {
      await this.store.dropConflict(userId);
      return { ok: false, error: 'no_conflict' };
    }
    await this.store.dropConflict(userId);
    if ((await this.store.holderOf(c.phone)) !== c.holderId) return { ok: false, error: 'no_conflict' };
    if (choice === 'load_previous') {
      await this.store.setPending(userId, null);
      return { ok: true, switchTo: c.holderId };
    }
    return (await this.store.moveNumber(c.holderId, userId, c.phone, this.now())) ? { ok: true, switchTo: null } : { ok: false, error: 'no_conflict' };
  }

  /** Proof of the number is in: a free number is simply verified; one held by another account becomes a choice for the player. */
  private async prove(userId: string, phone: string): Promise<'verified' | 'conflict' | 'taken'> {
    const holder = await this.store.holderOf(phone);
    if (holder && holder !== userId) {
      await this.store.putConflict(userId, { phone, holderId: holder, createdAt: this.now() });
      await this.store.dropOtp(userId);
      return 'conflict';
    }
    return (await this.store.markVerified(userId, phone, this.now())) ? 'verified' : 'taken';
  }

  /** Has the player typed (or verified) a number? Bale linking asks for this first. */
  async hasAny(userId: string): Promise<boolean> {
    const s = await this.store.state(userId);
    return s.phone !== null || s.pending !== null;
  }

  async setPending(userId: string, raw: string): Promise<SetPhoneResult> {
    if (!this.changes.take(userId)) return { ok: false, error: 'rate_limited' };
    const phone = normalizeIranPhone(raw);
    if (!phone) return { ok: false, error: 'invalid_phone' };
    const cur = await this.store.state(userId);
    if (cur.phone === phone) return { ok: true, status: await this.status(userId) };
    await this.store.setPending(userId, phone);
    await this.store.dropOtp(userId);
    return { ok: true, status: await this.status(userId) };
  }

  async clear(userId: string): Promise<void> {
    await this.store.clear(userId);
  }

  /**
   * The player shared a contact in the Bale bot. It counts only when it is the sender's OWN contact (`contactOwnerId` equals the
   * Bale user who sent it, so a forwarded contact of somebody else proves nothing) and matches the number typed in the app.
   */
  async verifyByContact(userId: string, contactPhone: string, contactOwnerId: string | undefined, senderId: string | undefined): Promise<ContactResult> {
    if (contactOwnerId === undefined || senderId === undefined || String(contactOwnerId) !== String(senderId)) return 'mismatch';
    const s = await this.store.state(userId);
    if (s.phone !== null && normalizeIranPhone(contactPhone) === s.phone) return 'already';
    if (s.pending === null) return 'no_pending';
    if (normalizeIranPhone(contactPhone) !== s.pending) return 'mismatch';
    return this.prove(userId, s.pending);
  }

  async sendSms(userId: string): Promise<SmsSendResult> {
    if (!smsReady(this.sms)) return { ok: false, error: 'sms_unavailable' };
    const s = await this.store.state(userId);
    if (!s.pending) return { ok: false, error: 'no_pending' };
    const rules = await this.rules();
    const old = await this.store.getOtp(userId);
    if (old && this.now() - old.sentAt < rules.smsResendMs) return { ok: false, error: 'too_soon', retryAfterSec: Math.ceil((rules.smsResendMs - (this.now() - old.sentAt)) / 1000) };
    const code = this.newCode();
    await this.store.putOtp(userId, { phone: s.pending, codeHash: hash(code, userId), attempts: 0, sentAt: this.now(), expiresAt: this.now() + rules.smsTtlMs });
    try {
      await this.sms.sendCode(s.pending, code, 'verify');
    } catch (e) {
      await this.store.dropOtp(userId);
      return { ok: false, error: smsErrorCode(e) };
    }
    return { ok: true };
  }

  async verifySms(userId: string, code: string): Promise<SmsVerifyResult> {
    const o = await this.store.getOtp(userId);
    if (!o) return { ok: false, error: 'no_code' };
    if (this.now() > o.expiresAt) return { ok: false, error: 'expired' };
    if (o.attempts >= MAX_OTP_ATTEMPTS) return { ok: false, error: 'too_many' };
    const s = await this.store.state(userId);
    if (s.pending !== o.phone) return { ok: false, error: 'no_code' }; // the number was changed after the code was sent
    if (hash(code.trim(), userId) !== o.codeHash) {
      await this.store.bumpOtp(userId);
      return { ok: false, error: 'wrong' };
    }
    const r = await this.prove(userId, o.phone);
    return r === 'taken' ? { ok: false, error: 'taken' } : { ok: true };
  }
}
