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
