import type { FastifyInstance } from 'fastify';
import { generateRequestSchema, saveSchema } from './content.js';
import { AiError } from './providers.js';
import type { AiStudio } from './studio.js';

const STATUS: Record<string, number> = { ai_not_configured: 503, ai_unknown_provider: 400, ai_rate_limited: 429, ai_timeout: 504, ai_unreachable: 502, ai_http_error: 502, ai_bad_output: 502, ai_invalid_model: 400, ai_not_found: 404 };

/** Admin routes of the AI studio. Needs the `content` permission (see accounts/permissions.ts); the API keys never leave the server. */
export function registerAiAdminRoutes(g: FastifyInstance, studio: AiStudio, audit: (action: string, target: string, detail?: string) => void) {
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
}
