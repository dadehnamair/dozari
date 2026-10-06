import { describe, expect, it } from 'vitest';
import type { BaleClient } from '../notify/client.js';
import { NotifyService } from '../notify/service.js';
import { createMemoryNotifyStore } from '../notify/store.js';

function boot() {
  const store = createMemoryNotifyStore();
  const sent: { chatId: string; text: string; opts?: { contactButton?: string; removeKeyboard?: boolean } }[] = [];
  const client: BaleClient = { async sendMessage(chatId, text, opts) { sent.push({ chatId, text, opts }); }, async getUpdates() { return []; } };
  const notify = new NotifyService(store, client);
  const accounts = new Map<string, string>();
  notify.signup = async (phone) => {
    const known = accounts.get(phone);
    if (known) return { userId: known, created: false };
    const userId = `u${accounts.size + 1}`;
    accounts.set(phone, userId);
    return { userId, created: true };
  };
  const text = (chat: number, t: string) => ({ update_id: 1, message: { message_id: 1, chat: { id: chat }, from: { id: chat }, text: t } });
  const contact = (chat: number, owner: number | undefined, phone: string) => ({ update_id: 1, message: { message_id: 1, chat: { id: chat }, from: { id: chat }, contact: { phone_number: phone, user_id: owner } } });
  return { notify, store, sent, accounts, text, contact };
}

describe('Bale bot signup', () => {
  it('/start asks for the contact; the sender’s own contact creates the account and links the chat', async () => {
    const t = boot();
    await t.notify.handleUpdate(t.text(5, '/start'));
    expect(t.sent[0]?.opts?.contactButton).toBeTruthy();
    await t.notify.handleUpdate(t.contact(5, 5, '+98 912 345 6789'));
    expect([...t.accounts]).toEqual([['+989123456789', 'u1']]);
    expect(await t.store.userOfChat('5')).toBe('u1');
    expect(t.sent.at(-1)?.opts?.removeKeyboard).toBe(true);
  });

  it('a forwarded contact of someone else creates nothing', async () => {
    const t = boot();
    await t.notify.handleUpdate(t.contact(5, 99, '09123456789'));
    expect(t.accounts.size).toBe(0);
    expect(await t.store.userOfChat('5')).toBeNull();
  });

  it('a known number links the chat to the existing account instead of creating another', async () => {
    const t = boot();
    await t.notify.handleUpdate(t.contact(5, 5, '09123456789'));
    await t.notify.handleUpdate(t.contact(6, 6, '09123456789'));
    expect(t.accounts.size).toBe(1);
    expect(await t.store.userOfChat('6')).toBe('u1');
    expect(await t.store.userOfChat('5')).toBeNull();
  });

  it('a linked chat is not asked again', async () => {
    const t = boot();
    await t.notify.handleUpdate(t.contact(5, 5, '09123456789'));
    t.sent.length = 0;
    await t.notify.handleUpdate(t.text(5, '/start'));
    expect(t.sent[0]?.opts?.contactButton).toBeUndefined();
  });
});
