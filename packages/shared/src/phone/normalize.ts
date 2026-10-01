const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC = '٠١٢٣٤٥٦٧٨٩';

const ascii = (raw: string): string =>
  [...raw]
    .map((c) => {
      const p = PERSIAN.indexOf(c);
      if (p >= 0) return String(p);
      const a = ARABIC.indexOf(c);
      return a >= 0 ? String(a) : c;
    })
    .join('');

/**
 * Iranian mobile number → `+989XXXXXXXXX`, or null when it is not one. Accepts 09…, 9…, +98…, 0098…, with Persian or Arabic
 * digits and spaces, dashes or brackets in between. Landlines and foreign numbers are refused on purpose: Bale and SMS are used
 * to verify the number, and it is stored in this one shape so two spellings can never be two accounts.
 */
export function normalizeIranPhone(raw: string): string | null {
  const digits = ascii(raw).replace(/[\s\-()]/g, '').replace(/^\+/, '');
  const m = /^(?:0098|98|0)?(9\d{9})$/.exec(digits);
  return m ? `+98${m[1]}` : null;
}

/** `+98912…4567` → «0912 ••• 4567»: enough for the owner to recognise it, nothing a screenshot can leak. */
export function maskPhone(phone: string): string {
  const national = phone.replace(/^\+98/, '0');
  return `${national.slice(0, 4)} ••• ${national.slice(-4)}`;
}
