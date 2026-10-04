import { normalizeIranPhone } from '@dozari/shared';

export const OTP_LENGTH = 5;
export const RESEND_SECONDS = 60;

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Digits only, Persian/Arabic digits turned to Latin, cut to `max` (what a phone keyboard or a pasted SMS may hand us). */
export function onlyDigits(raw: string, max: number): string {
  let out = '';
  for (const ch of raw) {
    const f = FA_DIGITS.indexOf(ch);
    const a = AR_DIGITS.indexOf(ch);
    const d = f >= 0 ? String(f) : a >= 0 ? String(a) : /\d/.test(ch) ? ch : '';
    if (d) out += d;
    if (out.length >= max) break;
  }
  return out;
}

/** The number as typed after the fixed «+98»: with or without the leading 0, with spaces. Null until it is a valid Iranian mobile. */
export function phoneFromInput(typed: string): string | null {
  const digits = onlyDigits(typed, 11);
  return normalizeIranPhone(digits.startsWith('0') ? digits : `0${digits}`);
}

/** Seconds left before another code may be asked for (never negative). */
export const resendLeft = (sentAt: number, now: number): number => Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000));
