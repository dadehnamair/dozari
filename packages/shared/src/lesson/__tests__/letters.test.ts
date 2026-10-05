import { describe, expect, it } from 'vitest';
import { joinsNext, letterCount, letterForms, splitWordLetters } from '../letters.js';

describe('splitWordLetters', () => {
  it('splits plain words', () => {
    expect(splitWordLetters('نان')).toEqual(['ن', 'ا', 'ن']);
    expect(splitWordLetters('سیب')).toEqual(['س', 'ی', 'ب']);
    expect(splitWordLetters('پفک')).toEqual(['پ', 'ف', 'ک']);
  });
  it('keeps «آ» as one letter and «لا» as two', () => {
    expect(splitWordLetters('آب')).toEqual(['آ', 'ب']);
    expect(splitWordLetters('لاک')).toEqual(['ل', 'ا', 'ک']);
  });
  it('ignores ZWNJ, spaces and tatweel and folds Arabic ي/ك', () => {
    expect(splitWordLetters('چوب‌شور')).toEqual(['چ', 'و', 'ب', 'ش', 'و', 'ر']);
    expect(splitWordLetters('مداد رنگی')).toHaveLength(8);
    expect(splitWordLetters('كيف')).toEqual(['ک', 'ی', 'ف']);
    expect(splitWordLetters('بــاد')).toEqual(['ب', 'ا', 'د']);
  });
  it('attaches marks to their letter', () => {
    expect(splitWordLetters('مُدّاد')).toEqual(['مُ', 'دّ', 'ا', 'د']);
  });
  it('returns nothing for digits and Latin', () => {
    expect(splitWordLetters('12 ab')).toEqual([]);
    expect(letterCount('')).toBe(0);
  });
});

describe('letterForms', () => {
  it('knows which letters join', () => {
    expect(joinsNext('ب')).toBe(true);
    expect(joinsNext('ا')).toBe(false);
    expect(joinsNext('و')).toBe(false);
  });
  it('marks joins around each letter', () => {
    expect(letterForms('نان')).toEqual([
      { letter: 'ن', joinsPrev: false, joinsNext: true },
      { letter: 'ا', joinsPrev: true, joinsNext: false },
      { letter: 'ن', joinsPrev: false, joinsNext: false },
    ]);
  });
});
