import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { permissionFor } from '../admin/accounts/permissions.js';
import { createSecretBox } from '../backup/crypto.js';
import { BackupService } from '../backup/service.js';
import type { BackupStorage } from '../backup/storage.js';
import type { BackupStore, RunRow, TargetInput, TargetRow } from '../backup/store.js';

const DAY = 86_400_000;

function memoryStore(): BackupStore & { targets: TargetRow[]; runs: RunRow[] } {
  const targets: TargetRow[] = [];
  const runs: RunRow[] = [];
  let n = 0;
  return {
    targets,
    runs,
    listTargets: async () => [...targets],
    getTarget: async (id) => targets.find((t) => t.id === id) ?? null,
    createTarget: async (i: TargetInput) => {
      const t: TargetRow = { ...i, id: `t${++n}`, lastScheduledAt: null, createdAt: Date.parse('2026-01-01T00:00:00Z') };
      targets.push(t);
      return t.id;
    },
    updateTarget: async (id, i) => {
      const t = targets.find((x) => x.id === id);
      if (!t) return 'not_found';
      Object.assign(t, i);
      return 'ok';
    },
    deleteTarget: async (id) => {
      targets.splice(0, targets.length, ...targets.filter((t) => t.id !== id));
    },
    markScheduled: async (id, at) => {
      targets.find((t) => t.id === id)!.lastScheduledAt = at.getTime();
    },
    createRun: async (r) => {
      const run: RunRow = { id: `r${++n}`, targetId: r.targetId, trigger: r.trigger, status: 'running', objectKey: r.objectKey, sizeBytes: null, error: null, startedAt: r.startedAt.getTime(), finishedAt: null, deletedAt: null, deletedReason: null };
      runs.push(run);
      return run.id;
    },
    finishRun: async (id, r) => {
      Object.assign(runs.find((x) => x.id === id)!, { status: r.status, sizeBytes: r.sizeBytes ?? null, error: r.error ?? null, finishedAt: r.finishedAt.getTime() });
    },
    failStaleRuns: async () => 0,
    listRuns: async (tid, limit, liveOnly) => runs.filter((r) => r.targetId === tid && (!liveOnly || (r.status === 'ok' && r.deletedAt === null))).sort((a, b) => b.startedAt - a.startedAt).slice(0, limit),
    getRun: async (id) => runs.find((r) => r.id === id) ?? null,
    markRunDeleted: async (id, reason, at) => {
      Object.assign(runs.find((r) => r.id === id)!, { deletedAt: at.getTime(), deletedReason: reason });
    },
  };
}

function setup(opts: { dumpFails?: boolean; protectLast?: number } = {}) {
  const store = memoryStore();
  const files = new Map<string, Buffer>();
  let clock = new Date('2026-01-10T00:00:00Z');
  const storage: BackupStorage = {
    check: async () => undefined,
    put: async (key, body) => {
      const chunks: Buffer[] = [];
      for await (const c of body) chunks.push(c as Buffer);
      files.set(key, Buffer.concat(chunks));
    },
    remove: async (key) => void files.delete(key),
    presignGet: async (key) => `https://s3.test/${key}?sig=1`,
  };
  const svc = new BackupService({
    store,
    box: createSecretBox('k'),
    storage: () => storage,
    dumper: () => ({ stream: Readable.from([Buffer.from('hello dump')]), done: opts.dumpFails ? Promise.reject(new Error('mysqldump exited with code 2')) : Promise.resolve() }),
    now: () => clock,
    protectLast: opts.protectLast ?? 1,
  });
  const fields = { name: 'a', endpoint: 'https://s3.test', region: '', bucket: 'bkt', prefix: 'db', accessKey: 'AK', isActive: true, schedule: { kind: 'daily' as const, time: '03:00' }, retention: { maxAgeDays: 3, maxCount: null } };
  return { store, files, svc, fields, setClock: (d: Date) => (clock = d) };
}

describe('secret box', () => {
  it('round-trips and rejects another key', () => {
    const sealed = createSecretBox('one').seal('s3cr3t');
    expect(sealed).not.toContain('s3cr3t');
    expect(createSecretBox('one').open(sealed)).toBe('s3cr3t');
    expect(createSecretBox('two').open(sealed)).toBeNull();
  });
});

describe('BackupService', () => {
  it('uploads a manual backup and records size', async () => {
    const { svc, store, files, fields } = setup();
    const id = await svc.create(fields, 'SECRET');
    expect(store.targets[0]!.secretKeyEnc).not.toContain('SECRET');
    const out = await svc.start(id, 'manual');
    expect(out.ok).toBe(true);
    expect(await svc.start(id, 'manual')).toEqual({ ok: false, error: 'busy' });
    await svc.idle();
    expect(store.runs[0]).toMatchObject({ status: 'ok', sizeBytes: 10, objectKey: 'db/dozari-20260110-000000.sql.gz' });
    expect(files.get('db/dozari-20260110-000000.sql.gz')?.toString()).toBe('hello dump');
  });

  it('records a failure and leaves no file behind', async () => {
    const { svc, store, files, fields } = setup({ dumpFails: true });
    const id = await svc.create(fields, 'SECRET');
    await svc.start(id, 'manual');
    await svc.idle();
    expect(store.runs[0]).toMatchObject({ status: 'failed' });
    expect(store.runs[0]!.error).toContain('mysqldump exited');
    expect(files.size).toBe(0);
  });

  it('never exposes the secret in the list view', async () => {
    const { svc, fields } = setup();
    await svc.create(fields, 'SECRET');
    const [view] = await svc.list();
    expect(JSON.stringify(view)).not.toContain('SECRET');
    expect(view!.secretOk).toBe(true);
  });

  it('the scheduler starts a due target once per slot', async () => {
    const { svc, store, setClock, fields } = setup();
    await svc.create(fields, 's');
    setClock(new Date('2026-01-01T12:00:00Z')); // before the first 03:00 Iran slot (23:30 UTC)
    expect(await svc.tick()).toBe(0);
    setClock(new Date('2026-01-01T23:31:00Z'));
    expect(await svc.tick()).toBe(1);
    await svc.idle();
    expect(await svc.tick()).toBe(0);
    expect(store.runs).toHaveLength(1);
    expect(store.runs[0]!.trigger).toBe('schedule');
  });

  it('skips switched-off targets', async () => {
    const { svc, setClock, fields } = setup();
    await svc.create({ ...fields, isActive: false }, 's');
    setClock(new Date('2026-02-01T00:00:00Z'));
    expect(await svc.tick()).toBe(0);
  });

  it('retention deletes expired files but keeps the newest', async () => {
    const { svc, store, files, setClock, fields } = setup();
    const id = await svc.create(fields, 's');
    for (const d of [0, 1, 2]) {
      setClock(new Date(Date.parse('2026-01-01T00:00:00Z') + d * DAY));
      await svc.start(id, 'manual');
      await svc.idle();
    }
    expect(files.size).toBe(3);
    setClock(new Date('2026-01-10T00:00:00Z')); // all older than 3 days
    expect(await svc.applyRetention(id)).toBe(2);
    expect(files.size).toBe(1);
    expect(files.has('db/dozari-20260103-000000.sql.gz')).toBe(true);
    expect(store.runs.filter((r) => r.deletedReason === 'retention')).toHaveLength(2);
  });

  it('manual delete and download link', async () => {
    const { svc, store, files, setClock, fields } = setup();
    const id = await svc.create({ ...fields, retention: { maxAgeDays: null, maxCount: null } }, 's');
    for (const d of [0, 1]) {
      setClock(new Date(Date.parse('2026-01-01T00:00:00Z') + d * DAY));
      await svc.start(id, 'manual');
      await svc.idle();
    }
    const [newest, oldest] = [store.runs[1]!.id, store.runs[0]!.id];
    expect(await svc.downloadUrl(oldest)).toMatchObject({ ok: true, url: expect.stringContaining('https://s3.test/') });
    expect(await svc.deleteRun(newest)).toBe('protected'); // the newest good backup is always locked
    expect(await svc.deleteRun(oldest)).toBe('ok');
    expect(files.size).toBe(1);
    expect(await svc.downloadUrl(oldest)).toEqual({ ok: false, error: 'not_found' });
  });

  it('removing a target can delete its unlocked files too', async () => {
    const { svc, files, setClock, fields, store } = setup();
    const id = await svc.create({ ...fields, retention: { maxAgeDays: null, maxCount: null } }, 's');
    for (const d of [0, 1]) {
      setClock(new Date(Date.parse('2026-01-01T00:00:00Z') + d * DAY));
      await svc.start(id, 'manual');
      await svc.idle();
    }
    expect(await svc.remove(id, true)).toBe('ok');
    expect(files.size).toBe(1); // the newest stays in the bucket
    expect(store.targets).toHaveLength(0);
  });
});

describe('protected newest backups', () => {
  it('retention, manual delete and target removal all leave the newest N', async () => {
    const { svc, store, files, setClock, fields } = setup({ protectLast: 2 });
    const id = await svc.create({ ...fields, retention: { maxAgeDays: 1, maxCount: 1 } }, 's');
    for (const d of [0, 1, 2, 3]) {
      setClock(new Date(Date.parse('2026-01-01T00:00:00Z') + d * DAY));
      await svc.start(id, 'manual');
      await svc.idle();
    }
    // Each run already applied the rules: with 4 runs and 2 locked, the 2 oldest were removed along the way.
    expect(files.size).toBe(2);
    setClock(new Date('2026-02-01T00:00:00Z'));
    expect(await svc.applyRetention(id)).toBe(0); // nothing more can go, however old
    const runs = (await svc.runs(id))!;
    expect(runs.filter((r) => r.protected && !r.deletedAt)).toHaveLength(2);
    const newest = store.runs.filter((r) => !r.deletedAt).map((r) => r.id);
    for (const rid of newest) expect(await svc.deleteRun(rid)).toBe('protected');
    expect(await svc.remove(id, true)).toBe('ok');
    expect(files.size).toBe(2); // the locked files stay in the bucket
  });
});

describe('permissions', () => {
  it('backups are owner-only even to read or download', () => {
    expect(permissionFor('GET', '/admin/backups')).toBe('system');
    expect(permissionFor('POST', '/admin/backups/runs/x/download')).toBe('system');
    expect(permissionFor('GET', '/admin/backups/abc/runs')).toBe('system');
  });
});
