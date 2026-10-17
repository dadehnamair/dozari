import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import { balePrefsSchema } from '@dozari/shared';
import type { PhoneService } from '../phone/service.js';
import type { NotifyService } from './service.js';

/** Player side: get a one-time code for the Bale bot, see whether Bale is linked, unlink. */
export function registerBaleRoutes(app: FastifyInstance, auth: AuthService, notify: NotifyService, botUsername: string | null, telegramBotUsername: string | null, phone?: { service: PhoneService; required: () => Promise<boolean> }) {
  app.get('/bale/link', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return { configured: notify.configured, linked: await notify.linked(user.id), botUsername, telegramBotUsername };
  });

  app.post('/bale/link-code', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!notify.configured) return reply.code(503).send({ error: 'bale_not_configured' });
    // The number comes first: it is what the bot verifies when the player shares their contact.
    if (phone && (await phone.required()) && !(await phone.service.hasAny(user.id))) return reply.code(409).send({ error: 'phone_required' });
    return { ...(await notify.linkCode(user.id)), botUsername, telegramBotUsername };
  });

  app.get('/bale/prefs', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return { muted: (await notify.prefs(user.id)).filter((k) => balePrefsSchema.shape.muted.element.safeParse(k).success) };
  });

  app.put('/bale/prefs', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const body = balePrefsSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });
    if (!(await notify.linked(user.id))) return reply.code(409).send({ error: 'not_linked' });
    await notify.setPrefs(user.id, body.data.muted);
    return body.data;
  });

  app.delete('/bale/link', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    await notify.unlink(user.id);
    return { ok: true };
  });
}
