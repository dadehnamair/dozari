import type { FastifyInstance } from 'fastify';
import { AI_LIMITS, AI_SCHEDULE_LIMITS } from '@dozari/shared';
import { generateRequestSchema, saveSchema } from './content.js';
import { AiError } from './providers.js';
import type { AiStudio } from './studio.js';
import { scheduleInputSchema } from './schedules.js';
import type { AiScheduler, ScheduleProblem } from './schedules.js';

const PROBLEM_STATUS: Record<ScheduleProblem, number> = { invalid_cron: 400, too_frequent: 400, never_runs: 400, topic_required: 400, count_too_high: 400, unknown_provider: 400, too_many: 409, not_found: 404 };

const STATUS: Record<string, number> = { ai_not_configured: 503, ai_unknown_provider: 400, ai_rate_limited: 429, ai_timeout: 504, ai_unreachable: 502, ai_http_error: 502, ai_bad_output: 502, ai_invalid_model: 400, ai_not_found: 404 };

/** Admin routes of the AI studio. Needs the `content` permission (see accounts/permissions.ts); the API keys never leave the server. */
export function registerAiAdminRoutes(g: FastifyInstance, studio: AiStudio, audit: (action: string, target: string, detail?: string) => void, schedules?: AiScheduler) {
  const run = async <T>(reply: { code(n: number): { send(b: unknown): unknown } }, fn: () => Promise<T>): Promise<T | unknown> => {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof AiError) g.log.warn({ code: err.code, providerStatus: err.status, providerMessage: err.detail }, 'ai studio call failed');
      if (err instanceof AiError) return reply.code(STATUS[err.code] ?? 500).send({ error: err.code, ...(err.status ? { providerStatus: err.status } : {}), ...(err.detail ? { providerMessage: err.detail } : {}) });
      throw err;
    }
  };

  g.get('/admin/ai', async () => studio.describe());

  g.get('/admin/ai/models', async (req, reply) => {
    const provider = (req.query as { provider?: string }).provider ?? '';
    return run(reply, async () => ({ provider, models: await studio.models(provider) }));
  });

  g.post('/admin/ai/generate', async (req, reply) => {
    const body = generateRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    return run(reply, async () => {
      const out = await studio.generate(body.data);
      void audit('ai.generate', body.data.kind, `${out.provider}/${out.model} ×${out.drafts.length}`);
      return out;
    });
  });

  g.post('/admin/ai/save', async (req, reply) => {
    const body = saveSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    return run(reply, async () => {
      const results = await studio.save(body.data);
      void audit('ai.save', body.data.kind, `${results.filter((r) => r.ok).length}/${results.length}`);
      return { results };
    });
  });

  if (!schedules) return;

  g.get('/admin/ai/schedules', async () => ({ schedules: await schedules.list(), limits: { minIntervalMinutes: AI_SCHEDULE_LIMITS.minIntervalMinutes, maxSchedules: AI_SCHEDULE_LIMITS.maxSchedules, tzOffsetMinutes: AI_SCHEDULE_LIMITS.tzOffsetMinutes, maxCount: AI_LIMITS.maxCount } }));

  g.post('/admin/ai/schedules', async (req, reply) => {
    const body = scheduleInputSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await schedules.create(body.data);
    if (!out.ok) return reply.code(PROBLEM_STATUS[out.error]).send({ error: out.error });
    void audit('ai.schedule.create', out.row.id, `${out.row.kind} ${out.row.cron}`);
    return { schedule: out.row };
  });

  g.put('/admin/ai/schedules/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = scheduleInputSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await schedules.update(id, body.data);
    if (!out.ok) return reply.code(PROBLEM_STATUS[out.error]).send({ error: out.error });
    void audit('ai.schedule.update', id, `${out.row.kind} ${out.row.cron}${out.row.enabled ? '' : ' (off)'}`);
    return { schedule: out.row };
  });

  g.delete('/admin/ai/schedules/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    if (!(await schedules.remove(id))) return reply.code(404).send({ error: 'not_found' });
    void audit('ai.schedule.delete', id);
    return { ok: true };
  });

  g.post('/admin/ai/schedules/:id/run', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const out = await schedules.runNow(id);
    if (!out.ok) return reply.code(out.error === 'busy' ? 409 : 404).send({ error: out.error });
    return { schedule: out.row };
  });
}
