import { fa } from '../i18n/fa';

/** Persian text for a phone-related server error code. */
export function phoneErrorText(code: string): string {
  return fa.phone.errors[code] ?? fa.phone.errors.generic ?? '';
}
