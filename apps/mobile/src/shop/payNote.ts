import { fa } from '../i18n/fa';
import type { InvoiceStatus } from '../miniapp/host';

/** The line shown after a real-money purchase attempt; a payment page the player simply closed says nothing. */
export const payNote = (result: 'sent' | InvoiceStatus): string | null =>
  result === 'sent' ? fa.shop.invoiceSent : result === 'paid' ? fa.shop.paid : result === 'pending' ? fa.shop.payPending : result === 'failed' ? fa.shop.payError : null;
