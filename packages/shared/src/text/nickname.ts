export interface NicknameRules {
  minLen: number;
  maxLen: number;
  allowDigits: boolean;
  allowLatin: boolean;
  allowPersian: boolean;
}

export type NicknameProblem = 'empty' | 'too_short' | 'too_long' | 'has_digits' | 'has_latin' | 'has_persian' | 'bad_chars';

export type NicknameCheck = { ok: true; value: string } | { ok: false; problem: NicknameProblem };

const DIGIT = /[0-9٠-٩۰-۹]/;
const LATIN = /[A-Za-z]/;
const PERSIAN_LETTER = /[ء-غف-يپچژکگی]/;
/** What may appear at all: letters, digits, space, half-space, underscore and dot. No emoji, no direction marks. */
const ALLOWED = /^[0-9A-Za-z٠-٩۰-۹ء-غف-يپچژکگی‌ _.]$/;

/** Cleans a typed name (trim, collapse spaces, Arabic ي/ك → ی/ک) and checks it against the rules. Pure. */
export function checkNickname(raw: string, rules: NicknameRules): NicknameCheck {
  const value = raw.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();
  const chars = [...value];
  if (chars.length === 0) return { ok: false, problem: 'empty' };
  if (chars.some((c) => !ALLOWED.test(c))) return { ok: false, problem: 'bad_chars' };
  if (chars.length < rules.minLen) return { ok: false, problem: 'too_short' };
  if (chars.length > rules.maxLen) return { ok: false, problem: 'too_long' };
  if (!rules.allowDigits && chars.some((c) => DIGIT.test(c))) return { ok: false, problem: 'has_digits' };
  if (!rules.allowLatin && chars.some((c) => LATIN.test(c))) return { ok: false, problem: 'has_latin' };
  if (!rules.allowPersian && chars.some((c) => PERSIAN_LETTER.test(c))) return { ok: false, problem: 'has_persian' };
  if (!chars.some((c) => PERSIAN_LETTER.test(c) || LATIN.test(c))) return { ok: false, problem: 'empty' };
  return { ok: true, value };
}
