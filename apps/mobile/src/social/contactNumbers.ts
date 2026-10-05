const DIGITS: Record<string, string> = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9', '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
/** Server cap of `POST /friends/find-contacts`. */
export const MAX_CONTACT_NUMBERS = 500;

/** One Iranian mobile in the `09xxxxxxxxx` form, or null (landlines, foreign numbers and junk are dropped before upload). */
export function iranianMobile(raw: string): string | null {
  const digits = [...raw].map((c) => DIGITS[c] ?? c).join('').replace(/[\s\-()]/g, '');
  const m = /^(?:\+98|0098|98|0)?(9\d{9})$/.exec(digits);
  return m ? `0${m[1]}` : null;
}

/** Unique Iranian mobiles out of raw address-book strings, at most `MAX_CONTACT_NUMBERS`. */
export function pickMobiles(raw: readonly string[]): string[] {
  const out = new Set<string>();
  for (const r of raw) {
    const n = iranianMobile(r);
    if (n) out.add(n);
    if (out.size >= MAX_CONTACT_NUMBERS) break;
  }
  return [...out];
}
