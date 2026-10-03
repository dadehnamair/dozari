import type { NotifyService } from '../notify/service.js';
import type { Audience, Channel, MessageStore, NewMessage } from './store.js';

export interface ChannelInfo {
  channel: Channel;
  available: boolean;
  /** Why a channel cannot be used (shown in the admin panel), Persian. */
  reason: string | null;
}

export type SendResult = { ok: true; id: string; recipients: Partial<Record<Channel, number>> } | { ok: false; error: 'CHANNEL_UNAVAILABLE' | 'NO_CHANNEL' | 'NO_RECIPIENTS' };

/**
 * The admin message center: one message, several channels. In-app inbox and Bale work; SMS, e-mail and push need
 * recipients (phone, e-mail, device tokens) and providers that do not exist yet, so they report themselves unavailable
 * instead of pretending to send.
 */
export class MessageCenter {
  constructor(
    private readonly store: MessageStore,
    private readonly bale: NotifyService | null,
  ) {}

  channels(): ChannelInfo[] {
    return [
      { channel: 'in_app', available: true, reason: null },
      { channel: 'bale', available: this.bale?.configured === true, reason: this.bale?.configured ? null : 'ربات بله تنظیم نشده (BALE_BOT_TOKEN)' },
      { channel: 'sms', available: false, reason: 'شماره‌ی بازیکن‌ها هنوز گرفته نمی‌شود و درگاه پیامک وصل نیست' },
      { channel: 'email', available: false, reason: 'ایمیل بازیکن‌ها هنوز گرفته نمی‌شود و سرویس ایمیل وصل نیست' },
      { channel: 'push', available: false, reason: 'اعلان پوش هنوز راه‌اندازی نشده (بدون سرویس‌های گوگل، باید جایگزین انتخاب شود)' },
    ];
  }

  async send(msg: NewMessage, channels: readonly Channel[]): Promise<SendResult> {
    const wanted = [...new Set(channels)];
    if (wanted.length === 0) return { ok: false, error: 'NO_CHANNEL' };
    const info = this.channels();
    if (wanted.some((c) => !info.find((i) => i.channel === c)?.available)) return { ok: false, error: 'CHANNEL_UNAVAILABLE' };
    const audience = await this.store.audienceUsers(msg.audience as Audience, msg.targetUserId);
    if (audience.length === 0) return { ok: false, error: 'NO_RECIPIENTS' };

    const id = await this.store.create(msg);
    const recipients: Partial<Record<Channel, number>> = {};
    if (wanted.includes('in_app')) {
      await this.store.deliverInbox(id, audience);
      recipients.in_app = audience.length;
    }
    if (wanted.includes('bale') && this.bale) {
      let n = 0;
      for (const userId of audience) if (await this.bale.notify(userId, 'admin', `${msg.title}\n\n${msg.body}`)) n += 1;
      recipients.bale = n;
    }
    for (const [channel, n] of Object.entries(recipients) as [Channel, number][]) await this.store.setChannel(id, channel, n);
    return { ok: true, id, recipients };
  }

  history(limit = 50) {
    return this.store.list(limit);
  }

  /** Who a sent message reached in their in-app inbox (up to 500; capped for huge broadcasts). */
  recipients(id: string) {
    return this.store.recipients(id, 500);
  }

  retract(id: string) {
    return this.store.retract(id, Date.now());
  }

  inbox(userId: string) {
    return this.store.inbox(userId, 50);
  }

  unread(userId: string) {
    return this.store.unread(userId);
  }

  markRead(userId: string, inboxId: string) {
    return this.store.markRead(userId, inboxId, Date.now());
  }

  markAllRead(userId: string) {
    return this.store.markAllRead(userId, Date.now());
  }
}
