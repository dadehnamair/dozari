/** Minimal Bale Bot API client. Bale's bot API mirrors Telegram's: `POST {base}/bot{token}/{method}` with a JSON body. */
export interface BaleUpdate {
  update_id: number;
  message?: {
    message_id: number;
    /** `type` is `private` for a one-to-one chat; absent is read as private. */
    chat: { id: number | string; type?: string; title?: string };
    from?: { id: number | string; first_name?: string };
    text?: string;
    contact?: { phone_number: string; user_id?: number | string; first_name?: string };
    /** A finished wallet payment (docs/logic/bale-payments.md): the only proof that money moved. */
    successful_payment?: { currency: string; total_amount: number; invoice_payload: string; telegram_payment_charge_id: string; provider_payment_charge_id?: string };
  };
  /** A tap on an inline-keyboard button (docs/logic/group-game.md). */
  callback_query?: { id: string; from: { id: number | string; first_name?: string }; message?: { message_id: number; chat: { id: number | string; type?: string } }; data?: string };
  /** The bot's own membership in a chat changed (added to or removed from a group). */
  my_chat_member?: { chat: { id: number | string; type?: string; title?: string }; new_chat_member: { status: string } };
  /** The user confirmed a wallet payment; the bot must answer within 10 seconds or it is cancelled. */
  pre_checkout_query?: { id: string; from: { id: number | string }; currency: string; total_amount: number; invoice_payload: string };
}

/** Inline keyboard: rows of buttons that either send `callback_data` back to the bot or open a `url`. */
export type InlineKeyboard = { text: string; callback_data?: string; url?: string }[][];

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
  /** A message with an inline keyboard (the group board); returns the new message's id. Optional so test doubles may leave it out. */
  sendInline?(chatId: string, text: string, keyboard: InlineKeyboard): Promise<{ messageId: number }>;
  /** Rewrites one of the bot's messages and its inline keyboard. */
  editInline?(chatId: string, messageId: number, text: string, keyboard: InlineKeyboard): Promise<void>;
  /** Answers a button tap (stops the spinner); `text` shows as a small toast. `chatId` only routes to the right bot. */
  answerCallback?(chatId: string, callbackId: string, text?: string): Promise<void>;
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
    async sendInline(chatId, text, keyboard) {
      const m = await call<{ message_id: number }>('sendMessage', { chat_id: chatId, text, reply_markup: { inline_keyboard: keyboard } }, 15_000);
      return { messageId: m.message_id };
    },
    async editInline(chatId, messageId, text, keyboard) {
      await call('editMessageText', { chat_id: chatId, message_id: messageId, text, reply_markup: { inline_keyboard: keyboard } }, 15_000);
    },
    async answerCallback(_chatId, callbackId, text) {
      await call('answerCallbackQuery', { callback_query_id: callbackId, ...(text ? { text } : {}) }, 8_000);
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

export const DEFAULT_TELEGRAM_BASE = 'https://api.telegram.org';

/**
 * Chats and users of the Telegram bot are stored with this prefix, so they can share the Bale tables (`bale_links`, the outbox) without
 * their ids ever meeting a Bale id, and the sender can tell which bot a chat belongs to.
 */
export const TELEGRAM_ID_PREFIX = 'tg:';
export const isTelegramId = (id: string | number): boolean => String(id).startsWith(TELEGRAM_ID_PREFIX);
const tgId = (id: number | string): string => `${TELEGRAM_ID_PREFIX}${id}`;
const rawId = (id: string): string => (id.startsWith(TELEGRAM_ID_PREFIX) ? id.slice(TELEGRAM_ID_PREFIX.length) : id);

/**
 * The Telegram bot, speaking the same dialect as the Bale one: updates come back with prefixed ids (`tg:123`) and sends accept them.
 * No wallet payments (Telegram has no rial provider); `TELEGRAM_API_BASE` points at a relay when api.telegram.org is blocked.
 */
export function createTelegramClient(token: string, opts: { base?: string; fetchImpl?: typeof fetch } = {}): BaleClient {
  const inner = createBaleClient(token, { base: opts.base ?? DEFAULT_TELEGRAM_BASE, fetchImpl: opts.fetchImpl });
  return {
    sendMessage: (chatId, text, o) => inner.sendMessage(rawId(chatId), text, o),
    sendInline: (chatId, text, kb) => inner.sendInline!(rawId(chatId), text, kb),
    editInline: (chatId, messageId, text, kb) => inner.editInline!(rawId(chatId), messageId, text, kb),
    answerCallback: (chatId, id, text) => inner.answerCallback!(rawId(chatId), id, text),
    async getUpdates(offset, timeoutSec) {
      return (await inner.getUpdates(offset, timeoutSec)).map((u): BaleUpdate => {
        const out: BaleUpdate = { update_id: u.update_id };
        const m = u.message;
        if (m) {
          out.message = {
            ...m,
            chat: { ...m.chat, id: tgId(m.chat.id) },
            ...(m.from ? { from: { ...m.from, id: tgId(m.from.id) } } : {}),
            ...(m.contact ? { contact: { ...m.contact, ...(m.contact.user_id !== undefined ? { user_id: tgId(m.contact.user_id) } : {}) } } : {}),
          };
        }
        if (u.callback_query) {
          const q = u.callback_query;
          out.callback_query = { ...q, from: { ...q.from, id: tgId(q.from.id) }, ...(q.message ? { message: { ...q.message, chat: { ...q.message.chat, id: tgId(q.message.chat.id) } } } : {}) };
        }
        if (u.my_chat_member) out.my_chat_member = { ...u.my_chat_member, chat: { ...u.my_chat_member.chat, id: tgId(u.my_chat_member.chat.id) } };
        return out;
      });
    },
  };
}

/**
 * One sender for both bots: a chat id with the Telegram prefix goes out through Telegram, any other through Bale. Receiving is not here
 * (each bot is polled on its own); invoices exist on Bale only.
 */
export function createMultiClient(bale: BaleClient | null, telegram: BaleClient | null): BaleClient | null {
  if (!bale && !telegram) return null;
  const pick = (chatId: string): BaleClient => {
    const c = isTelegramId(chatId) ? telegram : bale;
    if (!c) throw new Error(`no bot for chat ${chatId}`);
    return c;
  };
  return {
    sendMessage: async (chatId, text, o) => pick(chatId).sendMessage(chatId, text, o),
    sendInline: async (chatId, text, kb) => (await pick(chatId).sendInline!(chatId, text, kb)),
    editInline: async (chatId, messageId, text, kb) => pick(chatId).editInline!(chatId, messageId, text, kb),
    answerCallback: async (chatId, id, text) => pick(chatId).answerCallback!(chatId, id, text),
    getUpdates: async () => [],
    sendInvoice: bale?.sendInvoice ? (chatId, inv) => (isTelegramId(chatId) ? Promise.reject(new Error('no invoices on Telegram')) : bale.sendInvoice!(chatId, inv)) : undefined,
    createInvoiceLink: bale?.createInvoiceLink?.bind(bale),
    answerPreCheckoutQuery: bale?.answerPreCheckoutQuery?.bind(bale),
  };
}
