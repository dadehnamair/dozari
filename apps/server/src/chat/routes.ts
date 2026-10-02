import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ChatError } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { ChatService } from './service.js';

const STATUS: Record<ChatError, number> = {
  NO_CITY: 409, NEEDS_ACTIVATION: 403, MUTED: 403, RATE_LIMITED: 429, CONTACT_BLOCKED: 403, FILTERED: 422, TOO_LONG: 400, EMPTY: 400,
  UNKNOWN_TAUNT: 404, NOT_IN_MATCH: 409, NOT_FOUND: 404, OFF: 503,
};

const sendBody = z.union([z.object({ kind: z.literal('text'), text: z.string().max(1000) }), z.object({ kind: z.literal('taunt'), tauntId: z.string().uuid() })]);

/** Player side of chat: the taunt list, the city room (history + send), reports. */
export function registerChatRoutes(app: FastifyInstance, auth: AuthService, chat: ChatService) {
  app.get('/chat/taunts', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return { categories: await chat.taunts() };
  });

  app.get('/chat/city', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const out = await chat.history(user.id);
    if (out === 'NO_CITY') return reply.code(409).send({ error: 'NO_CITY' });
    if (out === 'OFF') return reply.code(503).send({ error: 'OFF' });
    return out;
  });

  app.post('/chat/city', async (req, reply) => {
    const user = await currentUser(auth, req);
    const body = sendBody.safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await chat.sendCity(user.id, body.data);
    return out.ok ? { message: out.message } : reply.code(STATUS[out.error]).send({ error: out.error, mutedUntil: out.mutedUntil });
  });

  app.post('/chat/report', async (req, reply) => {
    const user = await currentUser(auth, req);
    const body = z.object({ messageId: z.string().uuid(), reason: z.string().max(200).default('') }).safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await chat.report(user.id, body.data.messageId, body.data.reason);
    if (out === 'not_found') return reply.code(404).send({ error: 'NOT_FOUND' });
    if (out === 'own') return reply.code(400).send({ error: 'cannot_report_self' });
    if (out === 'duplicate') return reply.code(409).send({ error: 'duplicate' });
    return { ok: true };
  });
}
