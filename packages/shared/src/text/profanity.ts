/** Persian-aware text normalisation and word-list matching for the profanity filter (D69). Pure: no I/O. */

const ARABIC_TO_PERSIAN: Record<string, string> = { ي: 'ی', ى: 'ی', ك: 'ک', ة: 'ه', ۀ: 'ه', أ: 'ا', إ: 'ا', ٱ: 'ا', ؤ: 'و', ئ: 'ی' };
const DIACRITICS = /[ً-ٰٟـۖ-ۭ]/g; // harakat, dagger alef, tatweel, Quranic marks
const INVISIBLE = /[​-‏‪-‮⁠﻿]/g; // ZWSP, ZWNJ, ZWJ, bidi controls, BOM
const DIGIT_TO_ASCII: Record<string, string> = Object.fromEntries([...'۰۱۲۳۴۵۶۷۸۹'].map((d, i) => [d, String(i)]).concat([...'٠١٢٣٤٥٦٧٨٩'].map((d, i) => [d, String(i)])));

/**
 * Canonical form used to compare text with the word list: Arabic letter variants -> Persian, diacritics and invisible
 * characters removed, digits -> ASCII, Latin lower-cased, separators between letters dropped, runs of one letter collapsed.
 */
export function normalizeForFilter(input: string): string {
  let s = input.normalize('NFKC');
  s = s.replace(/[يىكةۀأإٱؤئ]/g, (c) => ARABIC_TO_PERSIAN[c] ?? c);
  s = s.replace(DIACRITICS, '').replace(INVISIBLE, '');
  s = s.replace(/[۰-۹٠-٩]/g, (c) => DIGIT_TO_ASCII[c] ?? c);
  s = s.toLowerCase();
  // «ک ص ا» / «ک.ص.ا» / «ک_ص_ا»: single letters split by separators are glued together.
  s = s.replace(/(?<=[\p{L}\d])[\s.\-_*+'"`~|/\\]+(?=[\p{L}\d])/gu, (m, offset: number, whole: string) => {
    const before = whole.slice(0, offset).match(/[\p{L}\d]+$/u)?.[0] ?? '';
    const after = whole.slice(offset + m.length).match(/^[\p{L}\d]+/u)?.[0] ?? '';
    return before.length <= 1 && after.length <= 1 ? '' : m;
  });
  // Runs of the same letter collapse to one («کصصصص» -> «کص»).
  s = s.replace(/(\p{L})\1+/gu, '$1');
  return s;
}

export type WordSeverity = 'block' | 'mask';

export interface FilterWord {
  word: string;
  severity: WordSeverity;
}

export interface FilterHit {
  word: string;
  severity: WordSeverity;
}

export type FilterResult = { ok: true; text: string } | { ok: false; hit: FilterHit };

/**
 * Checks `text` against the word list. A `block` hit rejects the text; `mask` hits are replaced by asterisks in the
 * returned text. Matching runs on the normalised text, so the list should hold plain words (they are normalised too).
 */
export function filterText(text: string, words: readonly FilterWord[]): FilterResult {
  const norm = normalizeForFilter(text);
  const normalizedWords = words.map((w) => ({ ...w, key: normalizeForFilter(w.word) })).filter((w) => w.key.length > 0);
  for (const w of normalizedWords) {
    if (w.severity === 'block' && norm.includes(w.key)) return { ok: false, hit: { word: w.word, severity: w.severity } };
  }
  let out = text;
  for (const w of normalizedWords) {
    if (w.severity !== 'mask' || !norm.includes(w.key)) continue;
    const letters = [...w.key].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\u200c.\\-_*]*');
    out = out.replace(new RegExp(letters, 'giu'), (m) => '*'.repeat(Math.max(1, [...m].length)));
  }
  return { ok: true, text: out };
}
