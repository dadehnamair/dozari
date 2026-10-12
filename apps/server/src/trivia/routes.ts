import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AgeTrack } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { TriviaService } from './service.js';

const idParam = z.object({ id: z.string().uuid() });
const startBody = z.object({ topicId: z.string().uuid().optional() });
const answerBody = z.object({ index: z.number().int().min(0).max(50), picked: z.number().int().min(0).max(3) });

/**
 * General four-choice mode (`/trivia/*`). `tracksOf` answers which question pools the player may play (their age track); without it
 * everybody plays the adult pool.
 */
export function registerTriviaRoutes(app: FastifyInstance, svc: TriviaService, auth?: AuthService, tracksOf?: (userId: string | undefined) => Promise<readonly AgeTrack[]>) {
  const tracks = async (userId: string | undefined): Promise<readonly AgeTrack[]> => (await tracksOf?.(userId).catch(() => undefined)) ?? ['adult'];

  app.get('/trivia/topics', async (req) => {
    const user = auth ? await currentUser(auth, req) : null;
    return { topics: await svc.topics(await tracks(user?.id)) };
  });

  app.post('/trivia/start', async (req, reply) => {
    const body = startBody.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const user = auth ? await currentUser(auth, req) : null;
    const view = await svc.start({ userId: user?.id, topicId: body.data.topicId, tracks: await tracks(user?.id) });
    if (!view) return reply.code(503).send({ error: 'no_questions' });
    return view;
  });

  app.get('/trivia/:id', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'invalid_id' });
    const view = svc.view(p.data.id);
    if (!view) return reply.code(404).send({ error: 'session_not_found' });
    return view;
  });

  app.post('/trivia/:id/answer', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    const b = answerBody.safeParse(req.body);
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = svc.answer(p.data.id, b.data.index, b.data.picked);
    if (out === null) return reply.code(404).send({ error: 'session_not_found' });
    if (out === 'unknown_question') return reply.code(404).send({ error: 'unknown_question' });
    return out;
  });
}
