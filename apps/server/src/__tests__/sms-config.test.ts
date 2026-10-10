import { describe, expect, it } from 'vitest';
import { createMemorySettingsStore } from '../settings/db-store.js';
import { SmsGateway, renderSmsText } from '../phone/smsConfig.js';

function fakeFetch(calls: { url: string; body: string }[]): typeof fetch {
  return (async (url: string, init?: { body?: string }) => {
    calls.push({ url: String(url), body: init?.body ?? '' });
    return new Response(JSON.stringify({ success: true, return: { status: 200 } }), { status: 200 });
  }) as unknown as typeof fetch;
}

describe('SmsGateway', () => {
  it('is not configured without any key', async () => {
    const gw = new SmsGateway(createMemorySettingsStore());
    await gw.refresh();
    expect(gw.configured).toBe(false);
    await expect(gw.sendCode('09123456789', '1')).rejects.toThrow();
  });

  it('uses the panel key and the per-purpose text, never echoing the key', async () => {
    const calls: { url: string; body: string }[] = [];
    const gw = new SmsGateway(createMemorySettingsStore(), {}, fakeFetch(calls));
    await gw.update({ provider: 'irnoti', irnotiKey: 'secret-key-1234' });
    expect(gw.configured).toBe(true);
    expect(await gw.setText('delete', 'حذف: {code}')).toBe(true);
    expect(await gw.setText('login', 'بدون کد')).toBe(false);
    await gw.sendCode('+989123456789', '55555', 'delete');
    expect(JSON.parse(calls[0]!.body)).toMatchObject({ to: '09123456789', text: 'حذف: 55555' });
    const state = await gw.adminState();
    expect(JSON.stringify(state)).not.toContain('secret-key');
    expect(state.irnoti.keyMask).toBe('••••1234');
    expect(state.active).toBe('irnoti');
    expect(state.texts.find((t) => t.purpose === 'delete')!.custom).toBe(true);
  });

  it('falls back to env keys on auto, and "off" disables them', async () => {
    const gw = new SmsGateway(createMemorySettingsStore(), { kavenegarKey: 'k', kavenegarTemplate: 't' });
    await gw.refresh();
    expect(gw.configured).toBe(true);
    expect((await gw.adminState()).active).toBe('kavenegar');
    await gw.update({ provider: 'off' });
    expect(gw.configured).toBe(false);
    await gw.update({ provider: 'auto' });
    expect(gw.configured).toBe(true);
  });

  it('resets a text to the default with an empty string', async () => {
    const gw = new SmsGateway(createMemorySettingsStore());
    await gw.setText('verify', 'x {code}');
    expect(await gw.textFor('verify')).toBe('x {code}');
    await gw.setText('verify', '');
    expect(await gw.textFor('verify')).toContain('{code}');
    expect(renderSmsText('a {code} b {code}', '1')).toBe('a 1 b 1');
  });
});

describe('SMS channel of the message center', () => {
  it('sends the body to verified numbers only and counts successes', async () => {
    const { MessageCenter } = await import('../messages/service.js');
    const { createMemoryMessageStore } = await import('../messages/store.js');
    const sent: string[] = [];
    const sender = { textReady: true, sendText: async (p: string, t: string) => { if (p === '0900') throw new Error('x'); sent.push(`${p}:${t}`); } };
    const store = createMemoryMessageStore({ users: ['a', 'b', 'c', 'd'], phones: { a: '09121', b: '0900', c: '09122' } });
    const center = new MessageCenter(store, null, sender);
    expect(center.channels().find((c) => c.channel === 'sms')!.available).toBe(true);
    const out = await center.send({ title: 'T', body: 'سلام', audience: 'all', targetUserId: null }, ['sms']);
    expect(out).toMatchObject({ ok: true, recipients: { sms: 2 } });
    expect(sent.sort()).toEqual(['09121:سلام', '09122:سلام']);
    expect(await center.send({ title: 'T', body: 'x'.repeat(301), audience: 'all', targetUserId: null }, ['sms'])).toEqual({ ok: false, error: 'SMS_TOO_LONG' });
    expect(new MessageCenter(store, null, { ...sender, textReady: false }).channels().find((c) => c.channel === 'sms')!.available).toBe(false);
  });
});
