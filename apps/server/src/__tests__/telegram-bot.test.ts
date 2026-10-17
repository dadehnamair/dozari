import { describe, expect, it, vi } from 'vitest';
import { createMultiClient, createTelegramClient, isTelegramId } from '../notify/client.js';
import type { BaleClient } from '../notify/client.js';

const reply = (result: unknown) => vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: true, result }), { status: 200 }));

describe('Telegram bot client', () => {
  it('prefixes chat, sender and contact ids of incoming updates, and strips the prefix when sending', async () => {
    const fetchImpl = reply([{ update_id: 5, message: { message_id: 1, chat: { id: 42 }, from: { id: 42 }, text: '/start ABC', contact: { phone_number: '+989121234567', user_id: 42 } } }]);
    const tg = createTelegramClient('1:tok', { fetchImpl: fetchImpl as unknown as typeof fetch });
    const [u] = await tg.getUpdates(0, 1);
    expect(u!.message!.chat.id).toBe('tg:42');
    expect(u!.message!.from!.id).toBe('tg:42');
    expect(u!.message!.contact!.user_id).toBe('tg:42');
    expect(String(fetchImpl.mock.calls[0]![0])).toBe('https://api.telegram.org/bot1:tok/getUpdates');
    await tg.sendMessage('tg:42', 'hi');
    expect(JSON.parse((fetchImpl.mock.calls[1]![1] as RequestInit).body as string).chat_id).toBe('42');
  });
});

describe('multi client', () => {
  const fake = (): BaleClient => ({ sendMessage: vi.fn(async () => undefined), getUpdates: async () => [] });
  it('sends through the bot a chat belongs to', async () => {
    const bale = fake();
    const telegram = fake();
    const multi = createMultiClient(bale, telegram)!;
    await multi.sendMessage('tg:42', 'a');
    await multi.sendMessage('77', 'b');
    expect(telegram.sendMessage).toHaveBeenCalledWith('tg:42', 'a', undefined);
    expect(bale.sendMessage).toHaveBeenCalledWith('77', 'b', undefined);
    expect(isTelegramId('tg:1')).toBe(true);
    expect(isTelegramId('1')).toBe(false);
  });
  it('fails a send for a bot that is not set up, and is null with no bot at all', async () => {
    expect(createMultiClient(null, null)).toBeNull();
    await expect(createMultiClient(fake(), null)!.sendMessage('tg:1', 'x')).rejects.toThrow();
  });
});
