import { describe, expect, it } from 'vitest';
import { checkNickname } from '../nickname.js';

const strict = { minLen: 2, maxLen: 10, allowDigits: false, allowLatin: false, allowPersian: true };

describe('checkNickname', () => {
  it('accepts a clean Persian name and tidies it', () => {
    expect(checkNickname('  علي   كوچولو ', strict)).toEqual({ ok: true, value: 'علی کوچولو' });
    expect(checkNickname('نوستالژی', strict)).toEqual({ ok: true, value: 'نوستالژی' });
  });
  it('enforces length in characters', () => {
    expect(checkNickname('ا', strict)).toEqual({ ok: false, problem: 'too_short' });
    expect(checkNickname('ابپتثجچحخد', strict).ok).toBe(true);
    expect(checkNickname('ابپتثجچحخدذ', strict)).toEqual({ ok: false, problem: 'too_long' });
    expect(checkNickname('   ', strict)).toEqual({ ok: false, problem: 'empty' });
  });
  it('refuses digits (Latin, Persian and Arabic-Indic) unless allowed', () => {
    for (const d of ['علی1', 'علی۱', 'علی١']) expect(checkNickname(d, strict)).toEqual({ ok: false, problem: 'has_digits' });
    expect(checkNickname('علی۱', { ...strict, allowDigits: true }).ok).toBe(true);
  });
  it('refuses Latin or Persian letters when switched off', () => {
    expect(checkNickname('Ali', strict)).toEqual({ ok: false, problem: 'has_latin' });
    expect(checkNickname('Ali', { ...strict, allowLatin: true }).ok).toBe(true);
    expect(checkNickname('علی', { ...strict, allowPersian: false, allowLatin: true })).toEqual({ ok: false, problem: 'has_persian' });
  });
  it('refuses emoji, direction marks and names without a letter', () => {
    expect(checkNickname('علی😀', strict)).toEqual({ ok: false, problem: 'bad_chars' });
    expect(checkNickname('‮علی', strict)).toEqual({ ok: false, problem: 'bad_chars' });
    expect(checkNickname('_ _', strict)).toEqual({ ok: false, problem: 'empty' });
  });
});
