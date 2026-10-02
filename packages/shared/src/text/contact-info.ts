const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC = '٠١٢٣٤٥٦٧٨٩';

const toAscii = (s: string): string =>
  [...s]
    .map((c) => {
      const p = PERSIAN.indexOf(c);
      if (p >= 0) return String(p);
      const a = ARABIC.indexOf(c);
      return a >= 0 ? String(a) : c;
    })
    .join('');

/**
 * Does free text carry a way to reach someone outside the game: a phone number, a link, a messenger handle? Chat blocks it unless the
 * sender holds the "share contact" badge (owner item 22). Spaces, dots and dashes inside digit runs do not hide a number, and Persian
 * digits count. This is a speed bump for casual sharing, not a guarantee: the profanity filter and reports still apply.
 */
export function containsContactInfo(text: string): boolean {
  const t = toAscii(text).toLowerCase();
  if (/https?:\/\/|www\./.test(t)) return true;
  if (/\b[a-z0-9-]+\.(ir|com|net|org|me|io|ly|app|co)\b/.test(t)) return true;
  if (/(^|\s)@[a-z0-9_.]{3,}/.test(t)) return true;
  if (/\b(t\.me|ble\.ir|wa\.me|instagram|insta|telegram|whatsapp|bale|eitaa|rubika)\b/.test(t) || /(تلگرام|واتساپ|واتس اپ|اینستا|اینستاگرام|ایتا|روبیکا|بله)\s*[:؛]?\s*[a-z0-9@_.]{3,}/.test(t)) return true;
  // A run of 8+ digits, even when broken up by spaces, dots, dashes or slashes.
  const digitsOnly = t.replace(/[\s.\-_/\\|()+]/g, '');
  if (/\d{8,}/.test(digitsOnly.replace(/[^\d]+/g, (m) => (m.length === 1 ? '' : '|')))) return true;
  return false;
}
