import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { GROUP_SIZE, OFFLINE_PACK_SIZE, hintKindSchema } from '@dozari/shared';
import type { GroupLevel } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { SoloService } from './service.js';
import type { PlayLimiter } from '../limits/play-limits.js';
import type { HintService } from './hints.js';

const paramsSchema = z.object({ id: z.string().uuid() });
const guessSchema = z.object({ productIds: z.array(z.string().min(1).max(64)).length(GROUP_SIZE) });

const priceGuessSchema = z.object({ level: z.number().int().min(0).max(3), guessRials: z.string().regex(/^\d{1,15}$/) });

/** Solo practice (no coins): the client only ever receives `SoloView`, never the solution. */
export function registerSoloRoutes(app: FastifyInstance, solo: SoloService, auth?: AuthService, hints?: HintService, limiter?: PlayLimiter) {
  app.post('/solo/start', async (req, reply) => {
    // Playing needs no account; a signed-in player's finished game counts toward their level and stats.
    const user = auth ? await currentUser(auth, req) : null;
    if (user && limiter) {
      const cap = await limiter.check(user.id, 'solo');
      if (!cap.ok) return reply.code(429).send({ error: 'daily_cap', cap: cap.cap });
    }
    const view = await solo.start(user?.id);
    if (view && user && limiter) void limiter.record(user.id, 'solo').catch(() => undefined);
    if (!view) return reply.code(503).send({ error: 'no_puzzles' });
    return view;
  });

  // Practice without internet: whole puzzles with their solutions (an owner-approved exception to rule 4; such games record nothing).
  app.get('/solo/offline-pack', async (req, reply) => {
    const user = auth ? await currentUser(auth, req) : null;
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const q = z.object({ n: z.coerce.number().int().min(1).max(OFFLINE_PACK_SIZE).default(OFFLINE_PACK_SIZE) }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'invalid_request' });
    return solo.offlinePack(user.id, q.data.n);
  });

  app.get('/solo/:id', async (req, reply) => {
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_id' });
    const view = solo.view(params.data.id);
    if (!view) return reply.code(404).send({ error: 'session_not_found' });
    return view;
  });

  app.post('/solo/:id/guess', async (req, reply) => {
    const params = paramsSchema.safeParse(req.params);
    const body = guessSchema.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'invalid_request' });
    const result = solo.guess(params.data.id, body.data.productIds);
    if (!result) return reply.code(404).send({ error: 'session_not_found' });
    return result;
  });

  app.get('/solo/:id/chart', async (req, reply) => {
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_id' });
    const chart = await solo.chart(params.data.id);
    if (chart === null) return reply.code(404).send({ error: 'session_not_found' });
    if (chart === 'in_progress') return reply.code(409).send({ error: 'game_in_progress' });
    return chart;
  });

  app.get('/solo/:id/price-rounds', async (req, reply) => {
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_id' });
    const rounds = await solo.priceRounds(params.data.id);
    if (rounds === null) return reply.code(404).send({ error: 'session_not_found' });
    if (rounds === 'in_progress') return reply.code(409).send({ error: 'game_in_progress' });
    return rounds;
  });

  app.post('/solo/:id/price-guess', async (req, reply) => {
    const params = paramsSchema.safeParse(req.params);
    const body = priceGuessSchema.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'invalid_request' });
    const guess = BigInt(body.data.guessRials);
    if (guess <= 0n) return reply.code(400).send({ error: 'invalid_request' });
    const result = await solo.priceGuess(params.data.id, body.data.level as GroupLevel, guess);
    if (result === null) return reply.code(404).send({ error: 'session_not_found' });
    if (result === 'in_progress') return reply.code(409).send({ error: 'game_in_progress' });
    if (result === 'unknown_round') return reply.code(404).send({ error: 'unknown_round' });
    return result;
  });

  app.post('/solo/:id/shuffle', async (req, reply) => {
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_id' });
    const view = solo.shuffle(params.data.id);
    if (!view) return reply.code(404).send({ error: 'session_not_found' });
    return view;
  });

  if (hints && auth) {
    const status = { not_found: 404, not_yours: 403, game_over: 409, level: 403, limit: 409, nothing_left: 409, insufficient: 402 } as const;
    app.get('/solo/:id/hints', async (req, reply) => {
      const user = await currentUser(auth, req);
      const params = paramsSchema.safeParse(req.params);
      if (!user) return reply.code(401).send({ error: 'unauthorized' });
      if (!params.success) return reply.code(400).send({ error: 'invalid_id' });
      const out = await hints.options(params.data.id, user.id);
      return typeof out === 'string' ? reply.code(status[out]).send({ error: out }) : out;
    });

    app.post('/solo/:id/nudge', async (req, reply) => {
      const user = await currentUser(auth, req);
      const params = paramsSchema.safeParse(req.params);
      if (!user) return reply.code(401).send({ error: 'unauthorized' });
      if (!params.success) return reply.code(400).send({ error: 'invalid_id' });
      const out = await hints.nudge(params.data.id, user.id);
      return typeof out === 'string' ? reply.code(status[out]).send({ error: out }) : out;
    });

    app.post('/solo/:id/hint', async (req, reply) => {
      const user = await currentUser(auth, req);
      const params = paramsSchema.safeParse(req.params);
      const body = z.object({ kind: hintKindSchema }).safeParse(req.body);
      if (!user) return reply.code(401).send({ error: 'unauthorized' });
      if (!params.success || !body.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await hints.take(params.data.id, user.id, body.data.kind);
      return typeof out === 'string' ? reply.code(status[out]).send({ error: out }) : out;
    });
  }
}
