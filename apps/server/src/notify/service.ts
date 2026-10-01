import { randomInt } from 'node:crypto';
import type { BaleClient, BaleUpdate } from './client.js';
import type { NotifyStore } from './store.js';
import { BALE_TEXT } from './texts.js';

export const LINK_CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Kinds of notification; admin settings can switch the automatic ones off. */
export type NotifyKind = 'match_result' | 'daily_ready' | 'friend_request' | 'broadcast' | 'admin' | 'test';

export class NotifyService {
  constructor(
    private readonly store: NotifyStore,
    private readonly client: BaleClient | null,
    private readonly now: () => number = Date.now,
    private readonly newCode: () => string = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(''),
  ) {}

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
    const msg = update.message;
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
    const linked = await this.store.redeemCode(candidate, chatId, this.now());
    await reply(linked ? BALE_TEXT.linked : BALE_TEXT.badCode);
  }
}
