import { createHash, randomInt } from 'node:crypto';
import { normalizeIranPhone } from '@dozari/shared';
import type { Session } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { RateLimiter } from '../security/rate-limit.js';
import { smsReady } from './sms.js';
import type { SmsClient } from './sms.js';
import { smsErrorCode } from './sms-errors.js';
import type { PhoneStore } from './store.js';

export type LoginCodeResult = { ok: true } | { ok: false; error: 'invalid_phone' | 'sms_unavailable' | 'too_soon' | 'rate_limited' | 'send_failed' | (string & {}); retryAfterSec?: number };
export type LoginVerifyResult = { ok: true; session: Session; created: boolean } | { ok: false; error: 'invalid_phone' | 'no_code' | 'expired' | 'wrong' | 'too_many' | 'banned' | 'taken' };

interface Otp {
  codeHash: string;
  attempts: number;
  sentAt: number;
  expiresAt: number;
}

const CODE_TTL_MS = 5 * 60_000;
const RESEND_MS = 60_000;
const MAX_ATTEMPTS = 5;
const hash = (phone: string, code: string) => createHash('sha256').update(`login:${phone}:${code}`).digest('hex');

/**
 * «ورود با شماره» (docs/logic/profile-and-identity.md §Phone login): from a fresh install the player proves a number by SMS and gets the
 * account that holds it; a number nobody holds yet becomes a new account (this device's guest) with that number verified. The code is
 * never tied to a logged-in user, so the answer for "does this number have an account" only appears after the code is proven (no enumeration).
 * Codes live in memory (one server process; a restart just means asking again).
 */
export class PhoneLoginService {
  private readonly codes = new Map<string, Otp>();
  /** SMS costs money and can be used to harass: 5 codes per hour per number. */
  private readonly perPhone = new RateLimiter(5, 60 * 60_000);

  constructor(
    private readonly store: PhoneStore,
    private readonly auth: AuthService,
    private readonly sms: SmsClient | null,
    private readonly now: () => number = Date.now,
    private readonly newCode: () => string = () => String(randomInt(10_000, 100_000)),
  ) {}

  get available(): boolean {
    return smsReady(this.sms);
  }

  async sendCode(rawPhone: string): Promise<LoginCodeResult> {
    const phone = normalizeIranPhone(rawPhone);
    if (!phone) return { ok: false, error: 'invalid_phone' };
    if (!smsReady(this.sms)) return { ok: false, error: 'sms_unavailable' };
    const old = this.codes.get(phone);
    if (old && this.now() - old.sentAt < RESEND_MS) return { ok: false, error: 'too_soon', retryAfterSec: Math.ceil((RESEND_MS - (this.now() - old.sentAt)) / 1000) };
    if (!this.perPhone.take(phone)) return { ok: false, error: 'rate_limited' };
    const code = this.newCode();
    this.codes.set(phone, { codeHash: hash(phone, code), attempts: 0, sentAt: this.now(), expiresAt: this.now() + CODE_TTL_MS });
    try {
      await this.sms.sendCode(phone, code, 'login');
    } catch (e) {
      this.codes.delete(phone);
      return { ok: false, error: smsErrorCode(e) };
    }
    return { ok: true };
  }

  /** Checks a code and burns it on success. */
  private async consume(phone: string, code: string): Promise<{ ok: true } | { ok: false; error: 'no_code' | 'expired' | 'wrong' | 'too_many' }> {
    const o = this.codes.get(phone);
    if (!o) return { ok: false, error: 'no_code' };
    if (this.now() > o.expiresAt) {
      this.codes.delete(phone);
      return { ok: false, error: 'expired' };
    }
    if (o.attempts >= MAX_ATTEMPTS) return { ok: false, error: 'too_many' };
    if (hash(phone, code.trim()) !== o.codeHash) {
      o.attempts += 1;
      return { ok: false, error: 'wrong' };
    }
    this.codes.delete(phone);
    return { ok: true };
  }

  /** Proves a number without touching any account (a guardian's number): the normalized phone on success. */
  async prove(rawPhone: string, code: string): Promise<{ ok: true; phone: string } | { ok: false; error: 'invalid_phone' | 'no_code' | 'expired' | 'wrong' | 'too_many' }> {
    const phone = normalizeIranPhone(rawPhone);
    if (!phone) return { ok: false, error: 'invalid_phone' };
    const out = await this.consume(phone, code);
    return out.ok ? { ok: true, phone } : out;
  }

  async verify(rawPhone: string, code: string, deviceId: string): Promise<LoginVerifyResult> {
    const phone = normalizeIranPhone(rawPhone);
    if (!phone) return { ok: false, error: 'invalid_phone' };
    const proven = await this.consume(phone, code);
    if (!proven.ok) return proven;
    const holder = await this.store.holderOf(phone);
    if (holder) {
      const session = await this.auth.sessionFor(holder, deviceId);
      return session ? { ok: true, session, created: false } : { ok: false, error: 'banned' };
    }
    // Nobody holds it: this device's account (made on first sight) takes the number.
    const guest = await this.auth.guestLogin(deviceId);
    if (!guest.ok) return { ok: false, error: 'banned' };
    if (!(await this.store.markVerified(guest.session.user.id, phone, this.now()))) return { ok: false, error: 'taken' };
    return { ok: true, session: guest.session, created: true };
  }
}
