import { INVITE_ALPHABET, INVITE_CODE_LENGTH } from '../config/invite.js';
import type { Rng } from '../game/rng.js';

export function generateInviteCode(rng: Rng): string {
  let out = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) out += INVITE_ALPHABET[Math.floor(rng() * INVITE_ALPHABET.length)];
  return out;
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** What a player typed → the stored form: upper-case Latin, Persian/Arabic digits to ASCII, no spaces or dashes. */
export function normalizeInviteCode(raw: string): string {
  const mapped = [...raw].map((c) => {
    const p = PERSIAN_DIGITS.indexOf(c);
    if (p >= 0) return String(p);
    const a = ARABIC_DIGITS.indexOf(c);
    return a >= 0 ? String(a) : c;
  });
  return mapped.join('').replace(/[\s\-_.]/g, '').toUpperCase();
}

/** Shape check only (an admin-made special code may be longer, up to 12). */
export function looksLikeInviteCode(code: string): boolean {
  return /^[2-9A-HJKMNP-Z]{4,12}$/.test(code);
}

/** A player's public ID: short, readable, searchable. Same alphabet as invite codes. */
export const HANDLE_LENGTH = 7;
export function generateHandle(rng: Rng): string {
  let out = '';
  for (let i = 0; i < HANDLE_LENGTH; i++) out += INVITE_ALPHABET[Math.floor(rng() * INVITE_ALPHABET.length)];
  return out;
}
