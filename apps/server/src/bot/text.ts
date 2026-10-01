/** Persian / Arabic-Indic digits and separators to ASCII, plus whitespace cleanup. */
export function normalizeDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٬،,]/g, ',')
    .replace(/٫/g, '.');
}

export function cleanText(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[‌‏‎]/g, (c) => (c === '‌' ? '‌' : ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Digits only (thousand separators dropped); null when there is no integer in the text. */
export function parseInteger(s: string): bigint | null {
  const t = normalizeDigits(s).replace(/,/g, '');
  const m = /\d+/.exec(t);
  return m ? BigInt(m[0]) : null;
}

/** Solar Hijri years the app accepts (rule 3); anything else (e.g. 2019) is not a Persian-calendar year. */
export function validSolarYear(y: number): boolean {
  return Number.isInteger(y) && y >= 1300 && y <= 1450;
}
