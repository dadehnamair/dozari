import { PassThrough } from 'node:stream';
import { BACKUP_DOWNLOAD_LINK_SECONDS, BACKUP_RUNS_LIST_LIMIT, BACKUP_TICK_SECONDS, backupObjectKey, expiredBackups, isBackupDue, nextRunAt } from '@dozari/shared';
import type { BackupRetention, BackupSchedule } from '@dozari/shared';
import type { SecretBox } from './crypto.js';
import type { Dumper } from './dump.js';
import type { BackupStorage, S3Params, StorageFactory } from './storage.js';
import type { BackupStore, RunRow, TargetInput, TargetRow } from './store.js';

export interface TargetView {
  id: string;
  name: string;
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
  accessKey: string;
  /** The secret itself is never sent out. False when it cannot be opened (the sealing key changed). */
  secretOk: boolean;
  isActive: boolean;
  schedule: BackupSchedule;
  retention: BackupRetention;
  nextRunAt: number | null;
  running: boolean;
  lastRun: RunRow | null;
  liveCount: number;
  liveBytes: number;
}

export interface TargetFields {
  name: string;
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
  accessKey: string;
  isActive: boolean;
  schedule: BackupSchedule;
  retention: BackupRetention;
}

export type BackupError = 'not_found' | 'busy' | 'secret_unreadable' | 'secret_required';

const short = (e: unknown): string => {
  const m = e instanceof Error ? e.message : String(e);
  return m.replace(/\s+/g, ' ').slice(0, 480);
};

export interface BackupDeps {
  store: BackupStore;
  box: SecretBox;
  storage: StorageFactory;
  dumper: Dumper;
  now?: () => Date;
  log?: (msg: string, err?: unknown) => void;
}

/** Database backups to S3-compatible targets: manual and scheduled runs, retention, listing (docs/logic/backups.md). */
export class BackupService {
  private readonly running = new Map<string, Promise<void>>();
  private readonly now: () => Date;
  private readonly log: (msg: string, err?: unknown) => void;

  constructor(private readonly d: BackupDeps) {
    this.now = d.now ?? (() => new Date());
    this.log = d.log ?? (() => undefined);
  }

  /** Call once at boot: a run left `running` by a dead process is closed as failed. */
  async init(): Promise<void> {
    const n = await this.d.store.failStaleRuns(this.now());
    if (n > 0) this.log(`backup: closed ${n} run(s) interrupted by a restart`);
  }

  /** Resolves when every run started so far is over (tests, graceful shutdown). */
  async idle(): Promise<void> {
    await Promise.allSettled([...this.running.values()]);
  }

  private params(t: Pick<TargetRow, 'endpoint' | 'region' | 'bucket' | 'accessKey' | 'secretKeyEnc'>): S3Params | null {
    const secretKey = this.d.box.open(t.secretKeyEnc);
    return secretKey === null ? null : { endpoint: t.endpoint, region: t.region, bucket: t.bucket, accessKey: t.accessKey, secretKey };
  }

  private async view(t: TargetRow): Promise<TargetView> {
    const [recent, live] = await Promise.all([this.d.store.listRuns(t.id, 1), this.d.store.listRuns(t.id, 1000, true)]);
    return {
      id: t.id,
      name: t.name,
      endpoint: t.endpoint,
      region: t.region,
      bucket: t.bucket,
      prefix: t.prefix,
      accessKey: t.accessKey,
      secretOk: this.d.box.open(t.secretKeyEnc) !== null,
      isActive: t.isActive,
      schedule: t.schedule,
      retention: t.retention,
      nextRunAt: t.isActive ? nextRunAt(t.schedule, new Date(t.lastScheduledAt ?? t.createdAt)).getTime() : null,
      running: this.running.has(t.id),
      lastRun: recent[0] ?? null,
      liveCount: live.length,
      liveBytes: live.reduce((a, r) => a + (r.sizeBytes ?? 0), 0),
    };
  }

  async list(): Promise<TargetView[]> {
    return Promise.all((await this.d.store.listTargets()).map((t) => this.view(t)));
  }

  async count(): Promise<number> {
    return (await this.d.store.listTargets()).length;
  }

  async create(f: TargetFields, secretKey: string): Promise<string> {
    const input: TargetInput = { ...f, secretKeyEnc: this.d.box.seal(secretKey) };
    return this.d.store.createTarget(input);
  }

  /** An empty `secretKey` keeps the stored one. */
  async update(id: string, f: TargetFields, secretKey: string | undefined): Promise<'ok' | 'not_found'> {
    const patch: Partial<TargetInput> = { ...f };
    if (secretKey) patch.secretKeyEnc = this.d.box.seal(secretKey);
    return this.d.store.updateTarget(id, patch);
  }

  /** Removes the target and its history; `deleteFiles` also removes the backup files still in the bucket. */
  async remove(id: string, deleteFiles: boolean): Promise<'ok' | 'not_found' | 'busy'> {
    const t = await this.d.store.getTarget(id);
    if (!t) return 'not_found';
    if (this.running.has(id)) return 'busy';
    if (deleteFiles) {
      const p = this.params(t);
      if (p) {
        const storage = this.d.storage(p);
        for (const r of await this.d.store.listRuns(id, 1000, true)) await storage.remove(r.objectKey).catch((e) => this.log(`backup: could not remove ${r.objectKey}`, e));
      }
    }
    await this.d.store.deleteTarget(id);
    return 'ok';
  }

  /** Writes and removes a small probe object. For an unsaved form pass the fields and the typed secret; for a saved target pass its id and leave the secret empty to use the stored one. */
  async test(f: Pick<TargetFields, 'endpoint' | 'region' | 'bucket' | 'prefix' | 'accessKey'>, secretKey: string | undefined, id?: string): Promise<{ ok: true } | { ok: false; error: BackupError | 'failed'; message?: string }> {
    let secret = secretKey;
    if (!secret) {
      const t = id ? await this.d.store.getTarget(id) : null;
      if (!t) return { ok: false, error: 'secret_required' };
      secret = this.d.box.open(t.secretKeyEnc) ?? undefined;
      if (!secret) return { ok: false, error: 'secret_unreadable' };
    }
    try {
      const probe = `${f.prefix.replace(/^\/+|\/+$/g, '')}${f.prefix.trim() ? '/' : ''}.dozari-check-${this.now().getTime()}`;
      await this.d.storage({ endpoint: f.endpoint, region: f.region, bucket: f.bucket, accessKey: f.accessKey, secretKey: secret }).check(probe);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'failed', message: short(e) };
    }
  }

  /** Starts a backup in the background and returns its run id. One run per target at a time. */
  async start(targetId: string, trigger: 'schedule' | 'manual'): Promise<{ ok: true; runId: string } | { ok: false; error: BackupError }> {
    const t = await this.d.store.getTarget(targetId);
    if (!t) return { ok: false, error: 'not_found' };
    if (this.running.has(targetId)) return { ok: false, error: 'busy' };
    const startedAt = this.now();
    const objectKey = backupObjectKey(t.prefix, startedAt);
    const runId = await this.d.store.createRun({ targetId, trigger, objectKey, startedAt });
    const job = this.execute(t, runId, objectKey).finally(() => this.running.delete(targetId));
    this.running.set(targetId, job);
    return { ok: true, runId };
  }

  private async execute(t: TargetRow, runId: string, objectKey: string): Promise<void> {
    const params = this.params(t);
    let storage: BackupStorage | undefined;
    let uploaded = false;
    try {
      if (!params) throw new Error('the stored secret key cannot be opened (the sealing key changed); enter the secret again');
      storage = this.d.storage(params);
      const dump = this.d.dumper();
      let size = 0;
      const counter = new PassThrough();
      counter.on('data', (c: Buffer) => {
        size += c.length;
      });
      dump.stream.on('error', (e) => counter.destroy(e));
      dump.stream.pipe(counter);
      await Promise.all([storage.put(objectKey, counter).then(() => (uploaded = true)), dump.done]);
      await this.d.store.finishRun(runId, { status: 'ok', sizeBytes: size, finishedAt: this.now() });
      this.log(`backup: ${t.name} ok (${size} bytes, ${objectKey})`);
    } catch (e) {
      if (storage && uploaded) await storage.remove(objectKey).catch(() => undefined); // never keep a file from a failed run
      await this.d.store.finishRun(runId, { status: 'failed', error: short(e), finishedAt: this.now() }).catch((err) => this.log('backup: could not record failure', err));
      this.log(`backup: ${t.name} failed`, e);
      return;
    }
    await this.applyRetention(t.id).catch((e) => this.log(`backup: retention failed for ${t.name}`, e));
  }

  /** Deletes the files the target's retention rule expires (never the newest good one). Returns how many were removed. */
  async applyRetention(targetId: string): Promise<number> {
    const t = await this.d.store.getTarget(targetId);
    if (!t) return 0;
    const runs = await this.d.store.listRuns(targetId, 1000, true);
    const victims = expiredBackups(runs.map((r) => ({ id: r.id, at: r.startedAt, ok: true })), t.retention, this.now());
    if (victims.length === 0) return 0;
    const p = this.params(t);
    if (!p) return 0;
    const storage = this.d.storage(p);
    let removed = 0;
    for (const id of victims) {
      const run = runs.find((r) => r.id === id)!;
      try {
        await storage.remove(run.objectKey);
        await this.d.store.markRunDeleted(id, 'retention', this.now());
        removed += 1;
      } catch (e) {
        this.log(`backup: could not remove ${run.objectKey}`, e);
      }
    }
    if (removed > 0) this.log(`backup: ${t.name} retention removed ${removed} file(s)`);
    return removed;
  }

  async runs(targetId: string): Promise<RunRow[] | null> {
    if (!(await this.d.store.getTarget(targetId))) return null;
    return this.d.store.listRuns(targetId, BACKUP_RUNS_LIST_LIMIT);
  }

  /** Removes one backup file by hand and keeps its row in the history as deleted. */
  async deleteRun(runId: string): Promise<'ok' | 'not_found' | 'busy' | 'secret_unreadable' | 'failed'> {
    const run = await this.d.store.getRun(runId);
    if (!run) return 'not_found';
    if (run.status === 'running') return 'busy';
    if (run.deletedAt !== null) return 'ok';
    if (run.status === 'ok') {
      const t = await this.d.store.getTarget(run.targetId);
      const p = t ? this.params(t) : null;
      if (!p) return 'secret_unreadable';
      try {
        await this.d.storage(p).remove(run.objectKey);
      } catch (e) {
        this.log(`backup: could not remove ${run.objectKey}`, e);
        return 'failed';
      }
    }
    await this.d.store.markRunDeleted(runId, 'manual', this.now());
    return 'ok';
  }

  /** A temporary link to download one backup. */
  async downloadUrl(runId: string): Promise<{ ok: true; url: string; expiresInSeconds: number } | { ok: false; error: 'not_found' | 'secret_unreadable' | 'failed' }> {
    const run = await this.d.store.getRun(runId);
    if (!run || run.status !== 'ok' || run.deletedAt !== null) return { ok: false, error: 'not_found' };
    const t = await this.d.store.getTarget(run.targetId);
    const p = t ? this.params(t) : null;
    if (!p) return { ok: false, error: 'secret_unreadable' };
    try {
      return { ok: true, url: await this.d.storage(p).presignGet(run.objectKey, BACKUP_DOWNLOAD_LINK_SECONDS), expiresInSeconds: BACKUP_DOWNLOAD_LINK_SECONDS };
    } catch (e) {
      this.log('backup: could not sign a download link', e);
      return { ok: false, error: 'failed' };
    }
  }

  /** Starts every active target whose schedule has come due. The attempt time is saved first, so a crash or a failed run waits for the next slot instead of looping. */
  async tick(): Promise<number> {
    const now = this.now();
    let started = 0;
    for (const t of await this.d.store.listTargets()) {
      if (!t.isActive || this.running.has(t.id)) continue;
      if (!isBackupDue(t.schedule, new Date(t.lastScheduledAt ?? t.createdAt), now)) continue;
      await this.d.store.markScheduled(t.id, now);
      if ((await this.start(t.id, 'schedule')).ok) started += 1;
    }
    return started;
  }
}

export interface BackupSchedulerHandle {
  stop(): void;
}

/** In-process clock: every minute check which targets are due; a failing tick is logged and the loop goes on. */
export function startBackupScheduler(opts: { service: BackupService; log: (msg: string, err?: unknown) => void }): BackupSchedulerHandle {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const loop = async () => {
    try {
      await opts.service.tick();
    } catch (err) {
      opts.log('backup: scheduler tick failed', err);
    }
    if (!stopped) timer = setTimeout(() => void loop(), BACKUP_TICK_SECONDS * 1000);
  };
  void opts.service.init().catch((err) => opts.log('backup: init failed', err));
  timer = setTimeout(() => void loop(), 5_000);
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
