import { fa } from '../i18n/fa';

/** The share message for a code (copied or sent through the share sheet). */
export function inviteMessage(code: string, bonus: number): string {
  return fa.invite.shareMessage(code, bonus);
}

/** Persian text for a redeem error code returned by the server. */
export function redeemErrorText(code: string): string {
  return fa.invite.errors[code] ?? fa.invite.errors.generic ?? '';
}
