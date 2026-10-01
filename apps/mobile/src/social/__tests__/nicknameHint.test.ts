import { describe, expect, it } from 'vitest';
import { nicknameHint } from '../nicknameHint';

describe('nicknameHint', () => {
  it('lists length and every refused kind of character', () => {
    expect(nicknameHint({ minLen: 2, maxLen: 20, allowDigits: false, allowLatin: false, allowPersian: true })).toBe('بین ۲ تا ۲۰ حرف، بدون عدد، بدون حرف انگلیسی');
    expect(nicknameHint({ minLen: 3, maxLen: 8, allowDigits: true, allowLatin: true, allowPersian: false })).toBe('بین ۳ تا ۸ حرف، بدون حرف فارسی');
  });
});
