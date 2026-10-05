import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { CoinPackageService, invoicePayload, parseInvoicePayload } from '../economy/coin-packages.js';
import { createMemoryCoinPackageStore } from '../economy/coin-packages-store.js';
import type { BaleClient, InvoiceRequest } from '../notify/client.js';
import { NotifyService } from '../notify/service.js';
import { createMemoryNotifyStore } from '../notify/store.js';

function memoryUsers(): UserRepository {
  const byId = new Map<string, UserRecord & { deviceId: string }>();
  return {
    async findByDeviceId(d) {
      return [...byId.values()].find((u) => u.deviceId === d) ?? null;
    },
    async findById(id) {
      return byId.get(id) ?? null;
    },
    async createGuest(deviceId, identity) {
      const user = { id: `00000000-0000-7000-8000-${String(byId.size + 1).padStart(12, '0')}`, deviceId, ...identity, isBanned: false };
      byId.set(user.id, user);
      return user;
    },
    async touch() {},
  };
}

async function boot(opts: { level?: number; token?: string | null } = {}) {
  const level = { v: opts.level ?? 5 };
  const store = createMemoryCoinPackageStore();
  const pkg = await store.addPackage({ titleFa: 'بسته‌ی ۵۰۰ سکه‌ای', coins: 500, priceRials: 500_000n, skuBazaar: null, skuMyket: null, minLevel: 3, isActive: true });
  const packages = new CoinPackageService(store, async () => level.v);
  const invoices: { chatId: string; invoice: InvoiceRequest }[] = [];
  const links: InvoiceRequest[] = [];
  const answers: { id: string; ok: boolean; message?: string }[] = [];
  const sent: { chatId: string; text: string }[] = [];
  const client: BaleClient = {
    async sendMessage(chatId, text) { sent.push({ chatId, text }); },
    async getUpdates() { return []; },
    async sendInvoice(chatId, invoice) { invoices.push({ chatId, invoice }); },
    async createInvoiceLink(invoice) { links.push(invoice); return 'https://ble.ir/invoice/abc'; },
    async answerPreCheckoutQuery(id, ok, message) { answers.push({ id, ok, message }); },
  };
  const notify = new NotifyService(createMemoryNotifyStore(), client, () => 1_000_000, () => 'ABC234');
  notify.payments = packages;
  notify.providerToken = opts.token === undefined ? 'wallet-token' : opts.token;
  const auth = new AuthService(memoryUsers(), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
  const app = buildServer({ auth, coinPackages: packages, notify });
  const login = async (n: number) => {
    const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}` } })).json() as { token: string; user: { id: string } };
    return { h: { authorization: `Bearer ${r.token}` }, id: r.user.id };
  };
  /** Links this player to a Bale chat the way the bot does. */
  const link = async (user: { h: Record<string, string>; id: string }, chat: number) => {
    await notify.linkCode(user.id);
    await notify.handleUpdate({ update_id: 1, message: { message_id: 1, chat: { id: chat }, from: { id: chat }, text: '/start ABC234' } });
  };
  const preCheckout = (id: string, from: number, payload: string, total = 500_000, currency = 'IRR') => notify.handleUpdate({ update_id: 2, pre_checkout_query: { id, from: { id: from }, currency, total_amount: total, invoice_payload: payload } });
  const paid = (chat: number, payload: string, charge: string, total = 500_000) => notify.handleUpdate({ update_id: 3, message: { message_id: 3, chat: { id: chat }, successful_payment: { currency: 'IRR', total_amount: total, invoice_payload: payload, telegram_payment_charge_id: charge } } });
  return { app, login, link, store, pkg, level, invoices, links, answers, sent, preCheckout, paid, notify };
}

describe('coin packages paid with the Bale wallet', () => {
  it('the payload round-trips and stays under the 128-byte limit', async () => {
    const { pkg } = await boot();
    const payload = invoicePayload(pkg.id, '00000000-0000-7000-8000-000000000001');
    expect(Buffer.byteLength(payload)).toBeLessThanOrEqual(128);
    expect(parseInvoicePayload(payload)).toEqual({ packageId: pkg.id, userId: '00000000-0000-7000-8000-000000000001' });
    expect(parseInvoicePayload('cp:nope')).toBeNull();
  });

  it('sends an invoice in integer rials to the linked chat', async () => {
    const t = await boot();
    const a = await t.login(1);
    await t.link(a, 777);
    const res = await t.app.inject({ method: 'POST', url: `/coin-packages/${t.pkg.id}/bale-invoice`, headers: a.h });
    expect(res.json()).toEqual({ ok: true });
    expect(t.invoices).toHaveLength(1);
    expect(t.invoices[0]).toMatchObject({ chatId: '777', invoice: { providerToken: 'wallet-token', prices: [{ amount: 500_000 }], payload: invoicePayload(t.pkg.id, a.id) } });
    expect(Number.isInteger(t.invoices[0]!.invoice.prices[0]!.amount)).toBe(true);
  });

  it('refuses an invoice without a Bale link, without a provider token, below the level, or for an unknown package', async () => {
    const t = await boot();
    const a = await t.login(1);
    expect((await t.app.inject({ method: 'POST', url: `/coin-packages/${t.pkg.id}/bale-invoice`, headers: a.h })).json()).toEqual({ error: 'bale_not_linked' });
    await t.link(a, 777);
    t.level.v = 1;
    expect((await t.app.inject({ method: 'POST', url: `/coin-packages/${t.pkg.id}/bale-invoice`, headers: a.h })).statusCode).toBe(403);
    expect((await t.app.inject({ method: 'POST', url: '/coin-packages/00000000-0000-7000-8000-0000000000aa/bale-invoice', headers: a.h })).statusCode).toBe(404);
    const noToken = await boot({ token: null });
    const b = await noToken.login(1);
    await noToken.link(b, 888);
    expect((await noToken.app.inject({ method: 'POST', url: `/coin-packages/${noToken.pkg.id}/bale-invoice`, headers: b.h })).json()).toEqual({ error: 'payments_unavailable' });
    expect(t.invoices).toHaveLength(0);
  });

  it('answers the pre-checkout yes only for the right payer, package, level and exact amount', async () => {
    const t = await boot();
    const a = await t.login(1);
    const b = await t.login(2);
    await t.link(a, 777);
    await t.link(b, 888);
    const payload = invoicePayload(t.pkg.id, a.id);
    await t.preCheckout('q1', 777, payload);
    await t.preCheckout('q2', 888, payload); // somebody else's invoice
    await t.preCheckout('q3', 777, payload, 400_000); // amount changed
    await t.preCheckout('q4', 777, payload, 500_000, 'USD');
    await t.preCheckout('q5', 777, 'garbage');
    t.level.v = 1;
    await t.preCheckout('q6', 777, payload); // level dropped
    expect(t.answers.map((x) => [x.id, x.ok])).toEqual([['q1', true], ['q2', false], ['q3', false], ['q4', false], ['q5', false], ['q6', false]]);
    expect(t.answers[1]!.message).toBeTruthy();
    expect(t.store.balances.size).toBe(0); // nothing credited by a pre-checkout
  });

  it('gives a mini-app player a payment link (no bot link needed) and keeps the amount in integer rials', async () => {
    const t = await boot();
    const a = await t.login(1);
    const res = await t.app.inject({ method: 'POST', url: `/coin-packages/${t.pkg.id}/bale-invoice-link`, headers: a.h });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ link: 'https://ble.ir/invoice/abc' });
    expect(t.links[0]).toMatchObject({ providerToken: 'wallet-token', payload: invoicePayload(t.pkg.id, a.id), prices: [{ amount: 500_000 }] });
  });

  it('refuses the payment link without login, below the level, or without a provider token', async () => {
    const t = await boot();
    expect((await t.app.inject({ method: 'POST', url: `/coin-packages/${t.pkg.id}/bale-invoice-link` })).statusCode).toBe(401);
    const a = await t.login(1);
    t.level.v = 1;
    expect((await t.app.inject({ method: 'POST', url: `/coin-packages/${t.pkg.id}/bale-invoice-link`, headers: a.h })).statusCode).toBe(403);
    const none = await boot({ token: null });
    const b = await none.login(1);
    expect((await none.app.inject({ method: 'POST', url: `/coin-packages/${none.pkg.id}/bale-invoice-link`, headers: b.h })).statusCode).toBe(503);
  });

  it('accepts the pre-checkout of an unlinked mini-app player, and still refuses somebody else', async () => {
    const t = await boot();
    const a = await t.login(1);
    const b = await t.login(2);
    t.notify.miniAppUserOf = async (baleId) => ({ '555': a.id, '556': b.id })[baleId] ?? null;
    const payload = invoicePayload(t.pkg.id, a.id);
    await t.preCheckout('m1', 555, payload);
    await t.preCheckout('m2', 556, payload); // another mini-app player paying a stranger's invoice
    await t.preCheckout('m3', 999, payload); // a Bale user with no account at all
    expect(t.answers.map((x) => [x.id, x.ok])).toEqual([['m1', true], ['m2', false], ['m3', false]]);
  });

  it('credits the coins exactly once on successful_payment, however often Bale repeats the update', async () => {
    const t = await boot();
    const a = await t.login(1);
    await t.link(a, 777);
    const payload = invoicePayload(t.pkg.id, a.id);
    await t.paid(777, payload, 'charge-1');
    await t.paid(777, payload, 'charge-1');
    expect(t.store.balances.get(a.id)).toBe(500);
    expect(t.sent.filter((m) => m.text.includes('500 سکه'))).toHaveLength(1);
    await t.paid(777, payload, 'charge-2'); // a second, genuine purchase
    expect(t.store.balances.get(a.id)).toBe(1000);
  });

  it('credits nothing for a wrong amount, an unknown package or a non-rial payment', async () => {
    const t = await boot();
    const a = await t.login(1);
    await t.paid(777, invoicePayload(t.pkg.id, a.id), 'c1', 1);
    await t.paid(777, invoicePayload('00000000-0000-7000-8000-0000000000aa', a.id), 'c2');
    await t.paid(777, 'garbage', 'c3');
    await t.notify.handleUpdate({ update_id: 4, message: { message_id: 4, chat: { id: 777 }, successful_payment: { currency: 'USD', total_amount: 500_000, invoice_payload: invoicePayload(t.pkg.id, a.id), telegram_payment_charge_id: 'c4' } } });
    expect(t.store.balances.size).toBe(0);
  });
});
