import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { BaleInvoice } from './coin-packages.js';
import type { ShopService } from './shop.js';
import type { ShopRealMoney } from './shop-real.js';

const idParam = z.object({ id: z.string().uuid() });

/** Player side of the coin shop. */
export function registerShopRoutes(app: FastifyInstance, auth: AuthService, shop: ShopService) {
  app.get('/shop', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return shop.shop(user.id);
  });

  app.get('/me/cosmetics', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return { worn: await shop.worn(user.id) };
  });

  app.post('/shop/:id/equip', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    const b = z.object({ equipped: z.boolean() }).safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await shop.equip(user.id, p.data.id, b.data.equipped);
    if (out !== 'ok') return reply.code(404).send({ error: 'not_owned' });
    return { ok: true, worn: await shop.worn(user.id) };
  });

  app.post('/shop/:id/buy', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await shop.buy(user.id, p.data.id);
    if (out.ok) return { balance: out.balance, gems: out.gems, tokens: out.tokens };
    const code = out.error === 'owned' ? 409 : out.error === 'unknown_item' || out.error === 'unavailable' ? 404 : out.error === 'insufficient' ? 402 : out.error === 'level' ? 403 : 409;
    return reply.code(code).send({ error: out.error, ...('minLevel' in out ? { minLevel: out.minLevel } : {}) });
  });
}

const redeemBody = z.object({ store: z.enum(['bazaar', 'myket']), orderId: z.string().trim().min(3).max(120), token: z.string().min(3).max(4000) });

/** Real-money side of the shop (D170); the gate turns the `/shop-pay` prefix off while `feature.coin_packages` is 0. */
export function registerShopPayRoutes(app: FastifyInstance, auth: AuthService, real: ShopRealMoney, bale?: { send(userId: string, invoice: BaleInvoice): Promise<'ok' | 'unavailable' | 'not_linked' | 'failed'>; link?(invoice: BaleInvoice): Promise<{ ok: true; link: string } | { ok: false; error: 'unavailable' | 'failed' }> }) {
  const status = (error: string) => (error === 'unknown_item' ? 404 : error === 'level' ? 403 : error === 'not_verified' ? 402 : 409);

  app.post('/shop-pay/:id/bale-invoice', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    if (!bale) return reply.code(503).send({ error: 'payments_unavailable' });
    const inv = await real.invoice(user.id, p.data.id);
    if (!inv.ok) return reply.code(status(inv.error)).send({ error: inv.error, ...(inv.minLevel ? { minLevel: inv.minLevel } : {}) });
    const sent = await bale.send(user.id, inv.invoice);
    if (sent === 'ok') return { ok: true };
    return reply.code(sent === 'not_linked' ? 409 : sent === 'failed' ? 502 : 503).send({ error: sent === 'unavailable' ? 'payments_unavailable' : sent === 'not_linked' ? 'bale_not_linked' : 'send_failed' });
  });

  // Bale mini-app: a payment link the page opens with `Bale.WebApp.openInvoice`; the credit still comes only from Bale's `successful_payment`.
  app.post('/shop-pay/:id/bale-invoice-link', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    if (!bale?.link) return reply.code(503).send({ error: 'payments_unavailable' });
    const inv = await real.invoice(user.id, p.data.id);
    if (!inv.ok) return reply.code(status(inv.error)).send({ error: inv.error, ...(inv.minLevel ? { minLevel: inv.minLevel } : {}) });
    const out = await bale.link(inv.invoice);
    if (out.ok) return { link: out.link };
    return reply.code(out.error === 'failed' ? 502 : 503).send({ error: out.error === 'failed' ? 'send_failed' : 'payments_unavailable' });
  });

  app.post('/shop-pay/:id/redeem', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    const b = redeemBody.safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await real.redeem(user.id, p.data.id, b.data);
    if (out.ok) return { ok: true, duplicate: out.duplicate };
    return reply.code(status(out.error)).send({ error: out.error, ...(out.minLevel ? { minLevel: out.minLevel } : {}) });
  });
}
