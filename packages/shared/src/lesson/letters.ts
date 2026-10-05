/**
 * Word → letters for the kid word lesson (docs/logic/age-tracks.md §Kid word lesson). Pure; no I/O.
 *
 * A «letter» is a base letter with its marks (tashdid, fathe …) attached. ZWNJ, spaces and tatweel are not letters.
 * Arabic ي/ك are folded to ی/ک. «لا» is two letters (ل، ا); «آ» is one.
 */
const MARK = /[ً-ٰٟۖ-ۭ]/; // harakat, tashdid, superscript alef, Quranic marks
const IGNORED = /[‌‍‎‏ـ\s]/; // ZWNJ, ZWJ, direction marks, tatweel, whitespace
const FOLD: Record<string, string> = { 'ي': 'ی', 'ى': 'ی', 'ك': 'ک', 'ە': 'ه', 'ۀ': 'ه' };
/** Letters that never join to the letter after them, so a word breaks visually after them. */
const NON_JOINERS = new Set(['ا', 'آ', 'أ', 'إ', 'د', 'ذ', 'ر', 'ز', 'ژ', 'و', 'ؤ', 'ء']);

function isLetter(ch: string): boolean {
  return /[ء-يٱ-ۓۺ-ۿ]/.test(ch) && !MARK.test(ch);
}

export function splitWordLetters(word: string): string[] {
  const letters: string[] = [];
  for (const raw of word.normalize('NFC')) {
    if (IGNORED.test(raw)) continue;
    const ch = FOLD[raw] ?? raw;
    if (MARK.test(ch)) {
      if (letters.length > 0) letters[letters.length - 1] += ch;
      continue;
    }
    if (isLetter(ch)) letters.push(ch);
  }
  return letters;
}

export function letterCount(word: string): number {
  return splitWordLetters(word).length;
}

/** Does this letter connect to the one that follows it? */
export function joinsNext(letter: string): boolean {
  const base = [...letter][0] ?? '';
  return base !== '' && !NON_JOINERS.has(base);
}

/**
 * Letters with how each one is drawn in the word: joined to the one before and/or after. Used to show «ن ـ ا ـ ن» style cards.
 * `joinsPrev` is true when the previous letter connects forward; `joinsNext` when this letter connects and a letter follows.
 */
export function letterForms(word: string): { letter: string; joinsPrev: boolean; joinsNext: boolean }[] {
  const letters = splitWordLetters(word);
  return letters.map((letter, i) => ({
    letter,
    joinsPrev: i > 0 && joinsNext(letters[i - 1]!),
    joinsNext: i < letters.length - 1 && joinsNext(letter),
  }));
}
