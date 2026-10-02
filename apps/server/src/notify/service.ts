import { randomInt } from 'node:crypto';
import { RateLimiter } from '../security/rate-limit.js';
import type { BaleClient, BaleUpdate } from './client.js';
import type { BaleInvoice, BalePaid, PreCheckout } from '../economy/coin-packages.js';
import type { PhoneService } from '../phone/service.js';
import type { NotifyStore } from './store.js';
import { BALE_TEXT } from './texts.js';

export const LINK_CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Kinds of notification; admin settings can switch the automatic ones off. */
export type NotifyKind = 'match_result' | 'daily_ready' | 'friend_request' | 'table_invite' | 'broadcast' | 'admin' | 'security' | 'test';

export class NotifyService {
  /** Wrong link codes per chat: 8 in 10 minutes, then the bot stays quiet (a 6-character code must not be guessable). */
  private readonly badCodes = new RateLimiter(8, 10 * 60_000);

  constructor(
    private readonly store: NotifyStore,
    private readonly client: BaleClient | null,
    private readonly now: () => number = Date.now,
    private readonly newCode: () => string = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(''),
  ) {}

  /** Set at start-up when phone verification exists; lets the bot accept a shared contact. */
  phone?: PhoneService;

  /** Set at start-up when coin packages exist: judges `pre_checkout_query` and credits `successful_payment`. */
  payments?: {
    preCheckout(payload: string, totalAmount: number, currency: string, payerUserId: string | null): Promise<PreCheckout>;
    creditPaid(payload: string, chargeId: string, totalAmount: number): Promise<BalePaid | null>;
  };

  /** Wallet payment token from @botfather (`BALE_PROVIDER_TOKEN`); without it nothing can be sold. */
  providerToken: string | null = null;

  /** Sends a coin-package invoice into the player's linked Bale chat. */
  async sendInvoice(userId: string, invoice: BaleInvoice): Promise<'ok' | 'unavailable' | 'not_linked' | 'failed'> {
    if (!this.client?.sendInvoice || !this.providerToken) return 'unavailable';
    const chatId = await this.store.chatOf(userId);
    if (!chatId) return 'not_linked';
    try {
      await this.client.sendInvoice(chatId, { title: invoice.title, description: invoice.description, payload: invoice.payload, providerToken: this.providerToken, prices: [{ label: invoice.label, amount: invoice.amountRials }] });
      return 'ok';
    } catch {
      return 'failed';
    }
  }

  get configured(): boolean {
    return this.client !== null;
  }

  /** A one-time code the player types to the bot; replaces any earlier code of theirs. */
  async linkCode(userId: string): Promise<{ code: string; expiresAt: number }> {
    const code = this.newCode();
    const expiresAt = this.now() + LINK_CODE_TTL_MS;
    await this.store.createCode(userId, code, expiresAt);
    return { code, expiresAt };
  }

  linked(userId: string): Promise<boolean> {
    return this.store.chatOf(userId).then((c) => c !== null);
  }

  unlink(userId: string): Promise<boolean> {
    return this.store.unlinkUser(userId);
  }

  /** Queues a message for a player; false when they have not linked Bale (nothing is stored then). */
  async notify(userId: string, kind: NotifyKind, text: string): Promise<boolean> {
    const chatId = await this.store.chatOf(userId);
    if (!chatId) return false;
    await this.store.enqueue({ chatId, userId, kind, text });
    return true;
  }

  /** Queues a message for a chat that is not a player (the admin's own chat). */
  async notifyChat(chatId: string, kind: NotifyKind, text: string): Promise<void> {
    await this.store.enqueue({ chatId, userId: null, kind, text });
  }

  /** Queues the same message for every linked player; returns how many. */
  async broadcast(text: string): Promise<number> {
    const all = await this.store.allLinked();
    for (const l of all) await this.store.enqueue({ chatId: l.chatId, userId: l.userId, kind: 'broadcast', text });
    return all.length;
  }

  /** Sends what is waiting. A failed send is retried on later flushes, up to 5 attempts. Returns how many went out. */
  async flush(limit = 30): Promise<number> {
    if (!this.client) return 0;
    let sent = 0;
    for (const row of await this.store.takePending(limit)) {
      try {
        await this.client.sendMessage(row.chatId, row.text);
        await this.store.markSent(row.id, this.now());
        sent += 1;
      } catch (err) {
        await this.store.markAttempt(row.id, err instanceof Error ? err.message : String(err), MAX_ATTEMPTS);
      }
    }
    return sent;
  }

  /** Announces the next daily reward to linked players whose cooldown just ended. */
  async announceDaily(cooldownMs: number): Promise<number> {
    const due = await this.store.dailyDue(this.now(), cooldownMs);
    for (const d of due) {
      await this.store.enqueue({ chatId: d.chatId, userId: d.userId, kind: 'daily_ready', text: BALE_TEXT.dailyReady });
      await this.store.markDailyNotified(d.userId, d.claimedAt);
    }
    return due.length;
  }

  /** One incoming message of the bot: link code, /status, /stop, else help. */
  async handleUpdate(update: BaleUpdate): Promise<void> {
    if (update.pre_checkout_query) return this.handlePreCheckout(update.pre_checkout_query);
    const msg = update.message;
    if (msg?.successful_payment) return this.handlePaid(msg.chat.id, msg.successful_payment);
    if (msg?.contact && this.client) return this.handleContact(update);
    const text = msg?.text?.trim();
    if (!msg || !text || !this.client) return;
    const chatId = String(msg.chat.id);
    const reply = (t: string) => this.client!.sendMessage(chatId, t).catch(() => undefined);
    const cmd = text.split(/\s+/)[0]!.toLowerCase();
    if (cmd === '/stop') return void (await reply((await this.store.unlinkChat(chatId)) ? BALE_TEXT.stopped : BALE_TEXT.notLinked));
    if (cmd === '/status') {
      const mine = (await this.store.allLinked()).some((l) => l.chatId === chatId);
      return void (await reply(mine ? BALE_TEXT.statusLinked : BALE_TEXT.notLinked));
    }
    // «/start CODE» (deep link) or just the code typed by hand.
    const candidate = (cmd === '/start' ? text.split(/\s+/)[1] : text)?.trim().toUpperCase();
    if (!candidate || !/^[A-Z0-9]{4,12}$/.test(candidate)) return void (await reply(BALE_TEXT.help));
    if (this.badCodes.blocked(chatId)) return;
    const linked = await this.store.redeemCode(candidate, chatId, this.now());
    if (!linked) this.badCodes.take(chatId);
    await reply(linked ? BALE_TEXT.linked : BALE_TEXT.badCode);
    if (linked && this.phone) {
      // Linked: if the number typed in the app is not verified yet, ask for the contact with a one-tap button.
      const st = await this.phone.status(linked.userId);
      if (!st.verified && st.pending) await this.client.sendMessage(chatId, BALE_TEXT.askContact, { contactButton: BALE_TEXT.contactButton }).catch(() => undefined);
    }
  }

  /** Must answer within 10 s (Bale cancels the payment otherwise): two DB reads and one HTTP call. */
  private async handlePreCheckout(q: NonNullable<BaleUpdate['pre_checkout_query']>): Promise<void> {
    const answer = this.client?.answerPreCheckoutQuery;
    if (!answer || !this.client) return;
    let verdict: PreCheckout = { ok: false, message: 'پرداخت فعلاً ممکن نیست.' };
    try {
      // A private chat's id is the user's id, so the paying Bale user maps to the linked player the same way a chat does.
      if (this.payments) verdict = await this.payments.preCheckout(q.invoice_payload, q.total_amount, q.currency, await this.store.userOfChat(String(q.from.id)));
    } catch {
      /* answer «no» below */
    }
    await answer.call(this.client, q.id, verdict.ok, verdict.ok ? undefined : verdict.message).catch(() => undefined);
  }

  /** The only moment coins are credited for a Bale payment; a replayed update credits nothing twice. */
  private async handlePaid(chatId: number | string, p: NonNullable<NonNullable<BaleUpdate['message']>['successful_payment']>): Promise<void> {
    if (!this.payments || p.currency !== 'IRR') return;
    const out = await this.payments.creditPaid(p.invoice_payload, p.telegram_payment_charge_id, p.total_amount);
    if (out && !out.duplicate) await this.client?.sendMessage(String(chatId), BALE_TEXT.paid(out.coins)).catch(() => undefined);
  }

  /** The sender shared a contact: it verifies the phone number only for the linked player and only when it is their own contact. */
  private async handleContact(update: BaleUpdate): Promise<void> {
    const msg = update.message!;
    const chatId = String(msg.chat.id);
    const say = (t: string, removeKeyboard = false) => this.client!.sendMessage(chatId, t, removeKeyboard ? { removeKeyboard: true } : undefined).catch(() => undefined);
    if (!this.phone) return;
    const userId = await this.store.userOfChat(chatId);
    if (!userId) return void (await say(BALE_TEXT.help));
    if (this.badCodes.blocked(chatId)) return;
    const out = await this.phone.verifyByContact(userId, msg.contact!.phone_number, msg.contact!.user_id === undefined ? undefined : String(msg.contact!.user_id), msg.from?.id === undefined ? undefined : String(msg.from.id));
    if (out === 'verified' || out === 'already') return void (await say(BALE_TEXT.phoneVerified, true));
    if (out === 'no_pending') return void (await say(BALE_TEXT.noPhonePending, true));
    if (out === 'conflict') return void (await say(BALE_TEXT.phoneConflict, true));
    if (out === 'taken') return void (await say(BALE_TEXT.phoneTaken, true));
    this.badCodes.take(chatId); // a wrong contact counts like a wrong code: guessing someone else's number is not free
    await say(BALE_TEXT.phoneMismatch);
  }
}
