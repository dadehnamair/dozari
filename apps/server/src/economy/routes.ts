import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MAX_DAILY_REWARD_COINS, MAX_DAILY_REWARD_DAYS } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { DailyRewardService } from './daily-reward.js';

const stepsBody = z.object({ steps: z.array(z.number().int().min(1).max(MAX_DAILY_REWARD_COINS)).min(1).max(MAX_DAILY_REWARD_DAYS) });

/** Player side: see the daily reward card, claim it. */
export function registerDailyRewardRoutes(app: FastifyInstance, auth: AuthService, daily: DailyRewardService) {
  app.get('/daily-reward', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return daily.status(user.id);
  });

  app.post('/daily-reward/claim', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const result = await daily.claim(user.id);
    if (result.ok) return result;
    return reply.code(result.error === 'TOO_EARLY' ? 409 : 503).send(result);
  });
}

/** Admin side (called inside the token-guarded scope): read and replace the day-by-day amounts. */
export function registerDailyRewardAdminRoutes(guarded: FastifyInstance, daily: DailyRewardService) {
  guarded.get('/admin/daily-reward', async () => ({ steps: await daily.steps() }));

  guarded.put('/admin/daily-reward', async (req, reply) => {
    const body = stepsBody.safeParse(req.body);
    if (!body.success || !(await daily.setSteps(body.data.steps))) return reply.code(400).send({ error: 'invalid_request' });
    return { steps: body.data.steps };
  });
}
