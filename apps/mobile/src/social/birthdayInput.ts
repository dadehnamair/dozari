/** Persian and Arabic-Indic digits typed on a phone keyboard → ASCII, then a whole number or null. */
export function wholeNumber(text: string): number | null {
  const ascii = text.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  return /^\d{1,4}$/.test(ascii.trim()) ? Number(ascii.trim()) : null;
}

/** The typed year / month / day as a birth date, or null while any part is missing or not a number. */
export function birthFromText(year: string, month: string, day: string): { year: number; month: number; day: number } | null {
  const y = wholeNumber(year);
  const m = wholeNumber(month);
  const d = wholeNumber(day);
  return y !== null && m !== null && d !== null ? { year: y, month: m, day: d } : null;
}
