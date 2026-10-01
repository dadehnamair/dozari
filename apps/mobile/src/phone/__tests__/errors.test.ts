import { describe, expect, it } from 'vitest';
import { phoneErrorText } from '../errors';

describe('phoneErrorText', () => {
  it('maps codes and falls back', () => {
    expect(phoneErrorText('invalid_phone')).toContain('موبایل');
    expect(phoneErrorText('taken')).toContain('حساب دیگری');
    expect(phoneErrorText('too_soon')).toContain('صبر');
    expect(phoneErrorText('???')).toBe('نتوانستیم انجام بدهیم.');
  });
});
