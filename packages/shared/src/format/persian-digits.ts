const WESTERN_TO_PERSIAN_DIGITS: Record<string, string> = {
  '0': '۰',
  '1': '۱',
  '2': '۲',
  '3': '۳',
  '4': '۴',
  '5': '۵',
  '6': '۶',
  '7': '۷',
  '8': '۸',
  '9': '۹',
};

/** Replaces every Western (ASCII) digit in `input` with its Persian digit, leaving everything else unchanged. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (digit) => WESTERN_TO_PERSIAN_DIGITS[digit] ?? digit);
}

/**
 * Formats a number the way the app displays numbers everywhere: Persian digits, Persian thousands
 * separators, no grouping ambiguity. Thin wrapper over `toLocaleString('fa-IR')` so every call site
 * agrees on rounding behavior instead of hand-rolling digit substitution.
 */
export function formatPersianNumber(value: number, maximumFractionDigits = 0): string {
  return value.toLocaleString('fa-IR', { maximumFractionDigits });
}

/**
 * What a number field shows while the player types: any digits (Persian, Arabic-Indic or Latin) read as one whole number,
 * grouped by three with «٬» and written with Persian digits. Anything that is not a digit is dropped; `parseTomanInput`
 * and friends read the result back.
 */
export function groupTypedNumber(raw: string): string {
  const ascii = raw
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '');
  return toPersianDigits(ascii.replace(/\B(?=(\d{3})+(?!\d))/g, '٬'));
}
