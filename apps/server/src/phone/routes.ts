import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DEVICE_ID_PATTERN, phoneChoiceSchema } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import { RateLimiter } from '../security/rate-limit.js';
import type { PhoneLoginService } from './login.js';
import type { PhoneService } from './service.js';

/** Player side: my number, change it, verify by SMS (Bale contact verification happens inside the bot). */
export function registerPhoneRoutes(app: FastifyInstance, auth: AuthService, phone: PhoneService) {
  app.get('/me/phone', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return phone.status(user.id);
  });

  app.put('/me/phone', async (req, reply) => {
    const user = await currentUser(auth, req);
    const body = z.object({ phone: z.string().max(30) }).safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await phone.setPending(user.id, body.data.phone);
    if (out.ok) return out.status;
    return reply.code(out.error === 'rate_limited' ? 429 : out.error === 'taken' ? 409 : 400).send({ error: out.error });
  });

  app.delete('/me/phone', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    await phone.clear(user.id);
    return { ok: true };
  });

  app.post('/me/phone/sms', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const out = await phone.sendSms(user.id);
    if (out.ok) return { ok: true };
    if (out.error === 'too_soon') return reply.header('retry-after', String(out.retryAfterSec ?? 60)).code(429).send({ error: out.error, retryAfterSec: out.retryAfterSec });
    return reply.code(out.error === 'sms_unavailable' ? 503 : out.error === 'send_failed' ? 502 : 409).send({ error: out.error });
  });

  // The player's answer when the proven number already belongs to another account.
  app.post('/me/phone/resolve', async (req, reply) => {
    const user = await currentUser(auth, req);
    const body = z.object({ choice: phoneChoiceSchema, deviceId: z.string().max(64).optional() }).safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await phone.resolve(user.id, body.data.choice);
    if (!out.ok) return reply.code(409).send({ error: out.error });
    if (out.switchTo === null) return { status: await phone.status(user.id), session: null };
    const session = await auth.sessionFor(out.switchTo, body.data.deviceId);
    return session ? { status: null, session } : reply.code(409).send({ error: 'account_unavailable' });
  });

  app.post('/me/phone/verify', async (req, reply) => {
    const user = await currentUser(auth, req);
    const body = z.object({ code: z.string().max(10) }).safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await phone.verifySms(user.id, body.data.code);
    if (out.ok) return phone.status(user.id);
    return reply.code(out.error === 'too_many' ? 429 : out.error === 'taken' ? 409 : 400).send({ error: out.error });
  });
}

/** Logged-out side: sign in with a number (SMS code) from a fresh install or a new phone. */
export function registerPhoneLoginRoutes(app: FastifyInstance, login: PhoneLoginService) {
  // Per client address: a flood of codes or guesses is cut off before it reaches the SMS provider.
  const perIp = new RateLimiter(20, 10 * 60_000);

  app.post('/auth/phone/code', async (req, reply) => {
    const body = z.object({ phone: z.string().max(30) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    if (!perIp.take(req.ip)) return reply.code(429).send({ error: 'rate_limited' });
    const out = await login.sendCode(body.data.phone);
    if (out.ok) return { ok: true };
    if (out.error === 'too_soon') return reply.header('retry-after', String(out.retryAfterSec ?? 60)).code(429).send({ error: out.error, retryAfterSec: out.retryAfterSec });
    return reply.code(out.error === 'sms_unavailable' ? 503 : out.error === 'send_failed' ? 502 : out.error === 'rate_limited' ? 429 : 400).send({ error: out.error });
  });

  app.post('/auth/phone/verify', async (req, reply) => {
    const body = z.object({ phone: z.string().max(30), code: z.string().max(10), deviceId: z.string().regex(DEVICE_ID_PATTERN) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    if (!perIp.take(req.ip)) return reply.code(429).send({ error: 'rate_limited' });
    const out = await login.verify(body.data.phone, body.data.code, body.data.deviceId);
    // `created` = a new account was made for this number (the app then shows the tutorial).
    if (out.ok) return { ...out.session, created: out.created };
    return reply.code(out.error === 'too_many' ? 429 : out.error === 'banned' ? 403 : out.error === 'taken' ? 409 : 400).send({ error: out.error });
  });
}
