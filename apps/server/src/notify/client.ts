/** Minimal Bale Bot API client. Bale's bot API mirrors Telegram's: `POST {base}/bot{token}/{method}` with a JSON body. */
export interface BaleUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number | string };
    from?: { id: number | string };
    text?: string;
    contact?: { phone_number: string; user_id?: number | string; first_name?: string };
    /** A finished wallet payment (docs/logic/bale-payments.md): the only proof that money moved. */
    successful_payment?: { currency: string; total_amount: number; invoice_payload: string; telegram_payment_charge_id: string; provider_payment_charge_id?: string };
  };
  /** The user confirmed a wallet payment; the bot must answer within 10 seconds or it is cancelled. */
  pre_checkout_query?: { id: string; from: { id: number | string }; currency: string; total_amount: number; invoice_payload: string };
}

export interface InvoiceRequest {
  title: string;
  description: string;
  payload: string;
  /** Wallet payment token from @botfather. */
  providerToken: string;
  prices: { label: string; amount: number }[];
}

export interface BaleClient {
  /** `contactButton` shows a one-tap keyboard button that shares the sender's own phone contact; `removeKeyboard` hides it again. */
  sendMessage(chatId: string, text: string, opts?: { contactButton?: string; removeKeyboard?: boolean }): Promise<void>;
  /** Long poll; returns [] when nothing arrived within `timeoutSec`. */
  getUpdates(offset: number, timeoutSec: number): Promise<BaleUpdate[]>;
  /** Wallet payment request into a chat (`sendInvoice`). Optional so test doubles may leave it out. */
  sendInvoice?(chatId: string, invoice: InvoiceRequest): Promise<void>;
  /** A payment link for mini-apps (`createInvoiceLink`; the page hands it to `Bale.WebApp.openInvoice`). */
  createInvoiceLink?(invoice: InvoiceRequest): Promise<string>;
  /** Yes / no to a `pre_checkout_query` (`answerPreCheckoutQuery`); a «no» carries the message the user sees. */
  answerPreCheckoutQuery?(id: string, ok: boolean, errorMessage?: string): Promise<void>;
}

export const DEFAULT_BALE_BASE = 'https://tapi.bale.ai';

export class BaleApiError extends Error {
  constructor(
    readonly method: string,
    readonly status: number,
    readonly description: string,
  ) {
    super(`bale ${method} ${status} ${description}`);
  }
}

export function createBaleClient(token: string, opts: { base?: string; fetchImpl?: typeof fetch } = {}): BaleClient {
  const base = (opts.base ?? DEFAULT_BALE_BASE).replace(/\/+$/, '');
  const doFetch = opts.fetchImpl ?? fetch;
  async function call<T>(method: string, body: unknown, timeoutMs: number): Promise<T> {
    const res = await doFetch(`${base}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
    if (!res.ok || json.ok === false) throw new BaleApiError(method, res.status, json.description ?? 'error');
    return json.result as T;
  }
  return {
    async sendMessage(chatId, text, opts) {
      const reply_markup = opts?.contactButton
        ? { keyboard: [[{ text: opts.contactButton, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true }
        : opts?.removeKeyboard
          ? { remove_keyboard: true }
          : undefined;
      await call('sendMessage', { chat_id: chatId, text, ...(reply_markup ? { reply_markup } : {}) }, 15_000);
    },
    async sendInvoice(chatId, invoice) {
      await call('sendInvoice', { chat_id: chatId, title: invoice.title, description: invoice.description, payload: invoice.payload, provider_token: invoice.providerToken, prices: invoice.prices }, 15_000);
    },
    async createInvoiceLink(invoice) {
      return call<string>('createInvoiceLink', { title: invoice.title, description: invoice.description, payload: invoice.payload, provider_token: invoice.providerToken, prices: invoice.prices }, 15_000);
    },
    async answerPreCheckoutQuery(id, ok, errorMessage) {
      await call('answerPreCheckoutQuery', { pre_checkout_query_id: id, ok, ...(ok ? {} : { error_message: errorMessage ?? 'پرداخت ممکن نیست.' }) }, 8_000);
    },
    async getUpdates(offset, timeoutSec) {
      return (await call<BaleUpdate[]>('getUpdates', { offset, timeout: timeoutSec }, (timeoutSec + 10) * 1000)) ?? [];
    },
  };
}
