import { and, asc, backupRuns, backupTargets, desc, eq, isNull } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { BackupRetention, BackupSchedule } from '@dozari/shared';

export interface TargetRow {
  id: string;
  name: string;
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
  accessKey: string;
  secretKeyEnc: string;
  isActive: boolean;
  schedule: BackupSchedule;
  retention: BackupRetention;
  lastScheduledAt: number | null;
  createdAt: number;
}

export type TargetInput = Omit<TargetRow, 'id' | 'lastScheduledAt' | 'createdAt'>;

export interface RunRow {
  id: string;
  targetId: string;
  trigger: 'schedule' | 'manual';
  status: 'running' | 'ok' | 'failed';
  objectKey: string;
  sizeBytes: number | null;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
  deletedAt: number | null;
  deletedReason: 'retention' | 'manual' | null;
}

/** I/O boundary of the backup system. */
export interface BackupStore {
  listTargets(): Promise<TargetRow[]>;
  getTarget(id: string): Promise<TargetRow | null>;
  createTarget(input: TargetInput): Promise<string>;
  updateTarget(id: string, input: Partial<TargetInput>): Promise<'ok' | 'not_found'>;
  deleteTarget(id: string): Promise<void>;
  markScheduled(id: string, at: Date): Promise<void>;
  createRun(r: { targetId: string; trigger: 'schedule' | 'manual'; objectKey: string; startedAt: Date }): Promise<string>;
  finishRun(id: string, r: { status: 'ok' | 'failed'; sizeBytes?: number; error?: string; finishedAt: Date }): Promise<void>;
  /** Runs left `running` by a process that died; they can never finish. Returns how many were closed. */
  failStaleRuns(at: Date): Promise<number>;
  /** Newest first. `liveOkOnly` = successful runs whose file is still in the bucket. */
  listRuns(targetId: string, limit: number, liveOkOnly?: boolean): Promise<RunRow[]>;
  getRun(id: string): Promise<RunRow | null>;
  markRunDeleted(id: string, reason: 'retention' | 'manual', at: Date): Promise<void>;
}

const targetRow = (r: typeof backupTargets.$inferSelect): TargetRow => ({
  id: r.id,
  name: r.name,
  endpoint: r.endpoint,
  region: r.region,
  bucket: r.bucket,
  prefix: r.prefix,
  accessKey: r.accessKey,
  secretKeyEnc: r.secretKeyEnc,
  isActive: r.isActive,
  schedule: r.scheduleKind === 'hourly' ? { kind: 'hourly', everyHours: r.scheduleEveryHours } : r.scheduleKind === 'daily' ? { kind: 'daily', time: r.scheduleTime } : { kind: 'weekly', weekday: r.scheduleWeekday, time: r.scheduleTime },
  retention: { maxAgeDays: r.keepDays, maxCount: r.keepCount },
  lastScheduledAt: r.lastScheduledAt ? r.lastScheduledAt.getTime() : null,
  createdAt: r.createdAt.getTime(),
});

const runRow = (r: typeof backupRuns.$inferSelect): RunRow => ({
  id: r.id,
  targetId: r.targetId,
  trigger: r.trigger,
  status: r.status,
  objectKey: r.objectKey,
  sizeBytes: r.sizeBytes,
  error: r.error,
  startedAt: r.startedAt.getTime(),
  finishedAt: r.finishedAt ? r.finishedAt.getTime() : null,
  deletedAt: r.deletedAt ? r.deletedAt.getTime() : null,
  deletedReason: r.deletedReason,
});

/** Flat columns for a target (the schedule is not JSON, D63). Columns the schedule kind does not use keep their defaults. */
function columns(i: Partial<TargetInput>) {
  const c: Partial<typeof backupTargets.$inferInsert> = {};
  if (i.name !== undefined) c.name = i.name;
  if (i.endpoint !== undefined) c.endpoint = i.endpoint;
  if (i.region !== undefined) c.region = i.region;
  if (i.bucket !== undefined) c.bucket = i.bucket;
  if (i.prefix !== undefined) c.prefix = i.prefix;
  if (i.accessKey !== undefined) c.accessKey = i.accessKey;
  if (i.secretKeyEnc !== undefined) c.secretKeyEnc = i.secretKeyEnc;
  if (i.isActive !== undefined) c.isActive = i.isActive;
  if (i.retention) {
    c.keepDays = i.retention.maxAgeDays;
    c.keepCount = i.retention.maxCount;
  }
  const s = i.schedule;
  if (s) {
    c.scheduleKind = s.kind;
    if (s.kind === 'hourly') c.scheduleEveryHours = s.everyHours;
    else c.scheduleTime = s.time;
    if (s.kind === 'weekly') c.scheduleWeekday = s.weekday;
  }
  return c;
}

export function createDbBackupStore(db: Db): BackupStore {
  return {
    async listTargets() {
      return (await db.select().from(backupTargets).orderBy(asc(backupTargets.createdAt))).map(targetRow);
    },
    async getTarget(id) {
      const [r] = await db.select().from(backupTargets).where(eq(backupTargets.id, id));
      return r ? targetRow(r) : null;
    },
    async createTarget(input) {
      const [r] = await db.insert(backupTargets).values({ ...columns(input), createdAt: new Date() } as typeof backupTargets.$inferInsert).$returningId();
      return r!.id;
    },
    async updateTarget(id, input) {
      const [res] = await db.update(backupTargets).set(columns(input)).where(eq(backupTargets.id, id));
      if (res.affectedRows > 0) return 'ok';
      return (await this.getTarget(id)) ? 'ok' : 'not_found'; // MySQL reports 0 affected rows when nothing changed
    },
    async deleteTarget(id) {
      await db.delete(backupTargets).where(eq(backupTargets.id, id));
    },
    async markScheduled(id, at) {
      await db.update(backupTargets).set({ lastScheduledAt: at }).where(eq(backupTargets.id, id));
    },
    async createRun(r) {
      const [row] = await db.insert(backupRuns).values({ targetId: r.targetId, trigger: r.trigger, objectKey: r.objectKey, startedAt: r.startedAt }).$returningId();
      return row!.id;
    },
    async finishRun(id, r) {
      await db.update(backupRuns).set({ status: r.status, sizeBytes: r.sizeBytes ?? null, error: r.error ?? null, finishedAt: r.finishedAt }).where(eq(backupRuns.id, id));
    },
    async failStaleRuns(at) {
      const [res] = await db.update(backupRuns).set({ status: 'failed', error: 'the server stopped while this backup was running', finishedAt: at }).where(eq(backupRuns.status, 'running'));
      return res.affectedRows;
    },
    async listRuns(targetId, limit, liveOkOnly = false) {
      const where = liveOkOnly ? and(eq(backupRuns.targetId, targetId), eq(backupRuns.status, 'ok'), isNull(backupRuns.deletedAt)) : eq(backupRuns.targetId, targetId);
      return (await db.select().from(backupRuns).where(where).orderBy(desc(backupRuns.startedAt)).limit(limit)).map(runRow);
    },
    async getRun(id) {
      const [r] = await db.select().from(backupRuns).where(eq(backupRuns.id, id));
      return r ? runRow(r) : null;
    },
    async markRunDeleted(id, reason, at) {
      await db.update(backupRuns).set({ deletedAt: at, deletedReason: reason }).where(eq(backupRuns.id, id));
    },
  };
}

