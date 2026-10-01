import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
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
