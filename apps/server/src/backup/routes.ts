import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BACKUP_MAX_TARGETS, backupRetentionSchema, backupScheduleSchema } from '@dozari/shared';
import { isHttpEndpoint } from './storage.js';
import type { BackupService } from './service.js';

const fieldsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  endpoint: z.string().trim().max(300).refine(isHttpEndpoint),
  region: z.string().trim().max(60).default(''),
  bucket: z.string().trim().min(3).max(120),
  prefix: z.string().trim().max(200).default(''),
  accessKey: z.string().trim().min(1).max(200),
  isActive: z.boolean().default(true),
  schedule: backupScheduleSchema,
  retention: backupRetentionSchema,
});
const secretSchema = z.string().min(1).max(300);
const idSchema = z.object({ id: z.string().uuid() });
const runIdSchema = z.object({ runId: z.string().uuid() });

/** Admin side of the database backups. Owner-only (`system` permission, also for reads: it lists where the backups live). */
export function registerBackupAdminRoutes(guarded: FastifyInstance, backups: BackupService, audit: (action: string, target: string, detail?: string) => void) {
  guarded.get('/admin/backups', async () => ({ targets: await backups.list(), maxTargets: BACKUP_MAX_TARGETS }));

  guarded.post('/admin/backups', async (req, reply) => {
    const b = fieldsSchema.extend({ secretKey: secretSchema }).safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
    if ((await backups.count()) >= BACKUP_MAX_TARGETS) return reply.code(409).send({ error: 'too_many' });
    const { secretKey, ...fields } = b.data;
    const id = await backups.create(fields, secretKey);
    audit('backup.target.create', id, `${fields.name} → ${fields.endpoint}/${fields.bucket}`);
    return reply.code(201).send({ id });
  });

  guarded.patch('/admin/backups/:id', async (req, reply) => {
    const p = idSchema.safeParse(req.params);
    const b = fieldsSchema.extend({ secretKey: secretSchema.optional() }).safeParse(req.body);
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    const { secretKey, ...fields } = b.data;
    if ((await backups.update(p.data.id, fields, secretKey)) === 'not_found') return reply.code(404).send({ error: 'not_found' });
    audit('backup.target.update', p.data.id, `${fields.name}${secretKey ? ' (new secret key)' : ''}`);
    return { ok: true };
  });

  guarded.delete('/admin/backups/:id', async (req, reply) => {
    const p = idSchema.safeParse(req.params);
    const q = z.object({ deleteFiles: z.enum(['0', '1']).default('0') }).safeParse(req.query);
    if (!p.success || !q.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await backups.remove(p.data.id, q.data.deleteFiles === '1');
    if (out !== 'ok') return reply.code(out === 'busy' ? 409 : 404).send({ error: out });
    audit('backup.target.delete', p.data.id, q.data.deleteFiles === '1' ? 'files deleted too' : 'files kept');
    return { ok: true };
  });

  guarded.post('/admin/backups/test', async (req, reply) => {
    const b = fieldsSchema.pick({ endpoint: true, region: true, bucket: true, prefix: true, accessKey: true }).extend({ secretKey: secretSchema.optional(), id: z.string().uuid().optional() }).safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
    const { secretKey, id, ...fields } = b.data;
    return backups.test(fields, secretKey, id);
  });

  guarded.post('/admin/backups/:id/run', async (req, reply) => {
    const p = idSchema.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await backups.start(p.data.id, 'manual');
    if (!out.ok) return reply.code(out.error === 'busy' ? 409 : 404).send({ error: out.error });
    audit('backup.run', p.data.id, out.runId);
    return reply.code(202).send({ runId: out.runId });
  });

  guarded.get('/admin/backups/:id/runs', async (req, reply) => {
    const p = idSchema.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    const runs = await backups.runs(p.data.id);
    return runs ? { runs } : reply.code(404).send({ error: 'not_found' });
  });

  guarded.delete('/admin/backups/runs/:runId', async (req, reply) => {
    const p = runIdSchema.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await backups.deleteRun(p.data.runId);
    if (out !== 'ok') return reply.code(out === 'not_found' ? 404 : out === 'failed' ? 502 : 409).send({ error: out });
    audit('backup.run.delete', p.data.runId);
    return { ok: true };
  });

  // POST on purpose: it hands out a link to the data, so even a read-only role must not reach it by a plain GET.
  guarded.post('/admin/backups/runs/:runId/download', async (req, reply) => {
    const p = runIdSchema.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await backups.downloadUrl(p.data.runId);
    if (!out.ok) return reply.code(out.error === 'not_found' ? 404 : 502).send({ error: out.error });
    audit('backup.download', p.data.runId);
    return { url: out.url, expiresInSeconds: out.expiresInSeconds };
  });
}
