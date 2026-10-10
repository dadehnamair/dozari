import { describe, expect, it } from 'vitest';
import { OTP_LENGTH, onlyDigits, phoneFromInput, resendLeft } from '../loginInput';

describe('login input', () => {
  it('keeps digits only, converts Persian and Arabic digits, and cuts to the length', () => {
    expect(onlyDigits('۱۲ ۳-٤٥abc6', OTP_LENGTH)).toBe('12345');
    expect(onlyDigits('', 5)).toBe('');
  });

  it('reads a mobile typed after +98 with or without the leading zero', () => {
    const want = phoneFromInput('09123456789');
    expect(want).not.toBeNull();
    expect(phoneFromInput('912 345 6789')).toBe(want);
    expect(phoneFromInput('۹۱۲۳۴۵۶۷۸۹')).toBe(want);
    expect(phoneFromInput('+989123456789')).toBe(want);
    expect(phoneFromInput('00989123456789')).toBe(want);
    expect(phoneFromInput('12345')).toBeNull();
    expect(phoneFromInput('')).toBeNull();
  });

  it('counts the resend wait down to zero', () => {
    expect(resendLeft(1000, 1000)).toBe(60);
    expect(resendLeft(1000, 31_000)).toBe(30);
    expect(resendLeft(1000, 500_000)).toBe(0);
  });
});
