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

describe('SmsGateway per-type patterns', () => {
  const okPattern = { batchId: '7', count: 1 };
  function pf(calls: { url: string; body: string }[], failPattern = false): typeof fetch {
    return (async (url: string, init?: { body?: string }) => {
      calls.push({ url: String(url), body: init?.body ?? '' });
      if (String(url).endsWith('/sms/pattern')) return failPattern ? new Response('{}', { status: 500 }) : new Response(JSON.stringify(okPattern), { status: 200 });
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as unknown as typeof fetch;
  }

  it('sends a pattern-type message through its own code and variables, plain text only as backup', async () => {
    const calls: { url: string; body: string }[] = [];
    const gw = new SmsGateway(createMemorySettingsStore(), {}, pf(calls));
    await gw.update({ provider: 'irnoti', irnotiKey: 'k' });
    expect(await gw.setPattern('login', { enabled: true, code: 'abc123', params: [{ name: 'otp', value: '{code}' }, { name: 'site', value: 'dozari' }] })).toBe(true);
    await gw.sendCode('+989123456789', '4821', 'login');
    expect(calls.map((c) => c.url)).toEqual(['https://api.irnoti.com/v1/sms/pattern']);
    expect(JSON.parse(calls[0]!.body)).toEqual({ code: 'abc123', to: '09123456789', params: { otp: '4821', site: 'dozari' } });
    // other types stay plain-first
    calls.length = 0;
    await gw.sendCode('+989123456789', '1', 'verify');
    expect(calls.map((c) => c.url)).toEqual(['https://api.irnoti.com/v1/sms/send']);
    const st = (await gw.adminState()).patterns;
    expect(st.find((x) => x.purpose === 'login')).toMatchObject({ enabled: true, code: 'abc123', custom: true });
    expect(st.find((x) => x.purpose === 'verify')).toMatchObject({ enabled: false, code: 'gdhsgcnt', params: [{ name: 'code', value: '{code}' }], custom: false });
  });

  it('falls back to plain text when the pattern fails, rejects bad input, and can be cleared', async () => {
    const calls: { url: string; body: string }[] = [];
    const gw = new SmsGateway(createMemorySettingsStore(), {}, pf(calls, true));
    await gw.update({ provider: 'irnoti', irnotiKey: 'k' });
    expect(await gw.setPattern('delete', { enabled: true, code: 'bad code!', params: [{ name: 'code', value: '{code}' }] })).toBe(false);
    expect(await gw.setPattern('delete', { enabled: true, code: 'p1', params: [{ name: '1x', value: '{code}' }] })).toBe(false);
    expect(await gw.setPattern('delete', { enabled: true, code: 'p1', params: [] })).toBe(false);
    await gw.setPattern('delete', { enabled: true, code: 'p1', params: [{ name: 'code', value: '{code}' }] });
    await gw.sendCode('+989123456789', '9', 'delete');
    expect(calls.map((c) => c.url)).toEqual(['https://api.irnoti.com/v1/sms/pattern', 'https://api.irnoti.com/v1/sms/send']);
    await gw.clearPattern('delete');
    expect((await gw.adminState()).patterns.find((x) => x.purpose === 'delete')).toMatchObject({ enabled: false, custom: false });
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

  it('retries through the irnoti pattern (gdhsgcnt) when the plain send fails, and surfaces the plain error if both fail', async () => {
    const calls: { url: string; body: string }[] = [];
    const f = (async (url: string, init?: { body?: string }) => {
      calls.push({ url: String(url), body: init?.body ?? '' });
      return String(url).endsWith('/sms/send')
        ? new Response('{}', { status: 500 })
        : new Response(JSON.stringify({ batchId: '919', count: 1, totalPrice: '980', replayed: false }), { status: 200 });
    }) as unknown as typeof fetch;
    const gw = new SmsGateway(createMemorySettingsStore(), {}, f);
    await gw.update({ provider: 'irnoti', irnotiKey: 'k' });
    await gw.sendCode('+989123456789', '4821', 'login');
    expect(calls.map((c) => c.url)).toEqual(['https://api.irnoti.com/v1/sms/send', 'https://api.irnoti.com/v1/sms/pattern']);
    expect(JSON.parse(calls[1]!.body)).toEqual({ code: 'gdhsgcnt', to: '09123456789', params: { code: '4821' } });

    const down = new SmsGateway(createMemorySettingsStore(), {}, (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch);
    await down.update({ provider: 'irnoti', irnotiKey: 'k' });
    await expect(down.sendCode('+989123456789', '1')).rejects.toThrow(/sms provider refused/);
  });
});
