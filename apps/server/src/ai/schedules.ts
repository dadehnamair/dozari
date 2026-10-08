import { z } from 'zod';
import { AGE_TRACKS, AI_LIMITS, AI_SCHEDULE_KINDS, AI_SCHEDULE_LIMITS, PRODUCT_CATEGORIES, minCronGapMinutes, nextCronRun, parseCron } from '@dozari/shared';
import type { AiScheduleKind } from '@dozari/shared';
import { aiSchedules, asc, eq, isNotNull, lte, and } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';
import { generateRequestSchema, saveSchema } from './content.js';
import type { GenerateRequest } from './content.js';
import { AiError } from './providers.js';
import type { AiStudio } from './studio.js';

/** What the editor sets for one schedule: when (cron, Tehran time), which provider/model, and the same options as a manual run of that kind. */
export const scheduleInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(AI_SCHEDULE_KINDS),
  enabled: z.boolean().default(true),
  cron: z.string().trim().min(1).max(60),
  provider: z.string().min(1).max(20),
  model: z.string().trim().max(80).default(''),
  hint: z.string().trim().max(AI_LIMITS.maxHintLength).default(''),
  count: z.number().int().min(1).max(20).default(1),
  ageTrack: z.enum(AGE_TRACKS).default('adult'),
  style: z.enum(['witty', 'plain']).default('witty'),
  /** Puzzle tier the scheduled puzzles are made for (puzzle_groups); null = mixed. */
  tierId: z.string().min(1).max(36).nullable().default(null),
  category: z.enum(PRODUCT_CATEGORIES).nullable().default(null),
  fromYear: z.number().int().min(1300).max(1450).nullable().default(null),
  toYear: z.number().int().min(1300).max(1450).nullable().default(null),
  topic: z.string().trim().max(AI_LIMITS.maxHintLength).default(''),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
  tone: z.enum(['friendly', 'nostalgic', 'informative']).default('friendly'),
});
export type ScheduleInput = z.infer<typeof scheduleInputSchema>;

export type RunStatus = 'ok' | 'empty' | 'error';

export interface ScheduleRow extends ScheduleInput {
  id: string;
  nextRunAt: number | null;
  lastRunAt: number | null;
  lastStatus: RunStatus | null;
  /** The `ai_*` error code on a failure, otherwise a short note. The panel turns it into Persian. */
  lastMessage: string;
  lastSaved: number;
  createdAt: number;
}

export interface RunResult {
  at: number;
  status: RunStatus;
  message: string;
  saved: number;
}

/** I/O boundary of the schedules. */
export interface AiScheduleStore {
  list(): Promise<ScheduleRow[]>;
  get(id: string): Promise<ScheduleRow | null>;
  create(input: ScheduleInput, nextRunAt: number | null): Promise<ScheduleRow>;
  update(id: string, input: ScheduleInput, nextRunAt: number | null): Promise<ScheduleRow | null>;
  remove(id: string): Promise<boolean>;
  /** Enabled schedules whose `nextRunAt` has passed. */
  due(now: number): Promise<ScheduleRow[]>;
  /** Records the outcome of a run and (when given) moves the next firing; `undefined` leaves `nextRunAt` alone. */
  finish(id: string, result: RunResult, nextRunAt?: number | null): Promise<void>;
  /** Moves the next firing without recording a run (taken before the run starts, so a crash or a slow call cannot fire twice). */
  setNext(id: string, nextRunAt: number | null): Promise<void>;
}

const toRow = (r: typeof aiSchedules.$inferSelect): ScheduleRow => ({
  id: r.id,
  name: r.name,
  kind: r.kind as AiScheduleKind,
  enabled: r.enabled,
  cron: r.cron,
  provider: r.provider,
  model: r.model,
  hint: r.hint,
  count: r.count,
  ageTrack: r.ageTrack as ScheduleInput['ageTrack'],
  style: r.style as ScheduleInput['style'],
  tierId: r.tierId,
  category: r.category as ScheduleInput['category'],
  fromYear: r.fromYear,
  toYear: r.toYear,
  topic: r.topic,
  length: r.length as ScheduleInput['length'],
  tone: r.tone as ScheduleInput['tone'],
  nextRunAt: r.nextRunAt ? r.nextRunAt.getTime() : null,
  lastRunAt: r.lastRunAt ? r.lastRunAt.getTime() : null,
  lastStatus: r.lastStatus as RunStatus | null,
  lastMessage: r.lastMessage,
  lastSaved: r.lastSaved,
  createdAt: r.createdAt.getTime(),
});

const inputColumns = (i: ScheduleInput) => ({ name: i.name, kind: i.kind, enabled: i.enabled, cron: i.cron, provider: i.provider, model: i.model, hint: i.hint, count: i.count, ageTrack: i.ageTrack, style: i.style, tierId: i.tierId, category: i.category, fromYear: i.fromYear, toYear: i.toYear, topic: i.topic, length: i.length, tone: i.tone });
const asDate = (ms: number | null) => (ms === null ? null : new Date(ms));

export function createDbAiScheduleStore(db: Db): AiScheduleStore {
  const one = async (id: string) => {
    const [r] = await db.select().from(aiSchedules).where(eq(aiSchedules.id, id));
    return r ? toRow(r) : null;
  };
  return {
    async list() {
      return (await db.select().from(aiSchedules).orderBy(asc(aiSchedules.createdAt), asc(aiSchedules.id))).map(toRow);
    },
    get: one,
    async create(input, nextRunAt) {
      const id = uuidv7();
      await db.insert(aiSchedules).values({ id, ...inputColumns(input), nextRunAt: asDate(nextRunAt) });
      return (await one(id))!;
    },
    async update(id, input, nextRunAt) {
      if (!(await one(id))) return null;
      await db.update(aiSchedules).set({ ...inputColumns(input), nextRunAt: asDate(nextRunAt) }).where(eq(aiSchedules.id, id));
      return one(id);
    },
    async remove(id) {
      if (!(await one(id))) return false;
      await db.delete(aiSchedules).where(eq(aiSchedules.id, id));
      return true;
    },
    async due(now) {
      return (await db.select().from(aiSchedules).where(and(eq(aiSchedules.enabled, true), isNotNull(aiSchedules.nextRunAt), lte(aiSchedules.nextRunAt, new Date(now)))).orderBy(asc(aiSchedules.nextRunAt))).map(toRow);
    },
    async finish(id, result, nextRunAt) {
      await db.update(aiSchedules).set({ lastRunAt: new Date(result.at), lastStatus: result.status, lastMessage: result.message.slice(0, AI_SCHEDULE_LIMITS.maxMessageLength), lastSaved: result.saved, ...(nextRunAt === undefined ? {} : { nextRunAt: asDate(nextRunAt) }) }).where(eq(aiSchedules.id, id));
    },
    async setNext(id, nextRunAt) {
      await db.update(aiSchedules).set({ nextRunAt: asDate(nextRunAt) }).where(eq(aiSchedules.id, id));
    },
  };
}

/** In-memory twin for tests. */
export function createMemoryAiScheduleStore(now: () => number = Date.now): AiScheduleStore {
  const rows = new Map<string, ScheduleRow>();
  let n = 0;
  return {
    async list() {
      return [...rows.values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)).map((r) => ({ ...r }));
    },
    async get(id) {
      const r = rows.get(id);
      return r ? { ...r } : null;
    },
    async create(input, nextRunAt) {
      const row: ScheduleRow = { ...input, id: `sch-${++n}`, nextRunAt, lastRunAt: null, lastStatus: null, lastMessage: '', lastSaved: 0, createdAt: now() };
      rows.set(row.id, row);
      return { ...row };
    },
    async update(id, input, nextRunAt) {
      const r = rows.get(id);
      if (!r) return null;
      Object.assign(r, input, { nextRunAt });
      return { ...r };
    },
    async remove(id) {
      return rows.delete(id);
    },
    async due(at) {
      return [...rows.values()].filter((r) => r.enabled && r.nextRunAt !== null && r.nextRunAt <= at).sort((a, b) => a.nextRunAt! - b.nextRunAt!).map((r) => ({ ...r }));
    },
    async finish(id, result, nextRunAt) {
      const r = rows.get(id);
      if (!r) return;
      Object.assign(r, { lastRunAt: result.at, lastStatus: result.status, lastMessage: result.message, lastSaved: result.saved });
      if (nextRunAt !== undefined) r.nextRunAt = nextRunAt;
    },
    async setNext(id, nextRunAt) {
      const r = rows.get(id);
      if (r) r.nextRunAt = nextRunAt;
    },
  };
}

export type ScheduleProblem = 'invalid_cron' | 'too_frequent' | 'never_runs' | 'topic_required' | 'count_too_high' | 'unknown_provider' | 'too_many' | 'not_found';

export type ScheduleOutcome = { ok: true; row: ScheduleRow } | { ok: false; error: ScheduleProblem };

/** The generate request a schedule stands for (the same one a manual run would send). */
export function requestFor(s: ScheduleInput): GenerateRequest {
  const base = { provider: s.provider, model: s.model || undefined, hint: s.hint || undefined };
  switch (s.kind) {
    case 'products':
      return generateRequestSchema.parse({ ...base, kind: 'products', count: s.count, category: s.category ?? undefined, ageTrack: s.ageTrack, fromYear: s.fromYear ?? undefined, toYear: s.toYear ?? undefined });
    case 'kid_lessons':
      return generateRequestSchema.parse({ ...base, kind: 'kid_lessons', count: s.count });
    case 'puzzle_groups':
      return generateRequestSchema.parse({ ...base, kind: 'puzzle_groups', count: s.count, ageTrack: s.ageTrack, style: s.style, ...(s.tierId ? { tierId: s.tierId } : {}) });
    case 'blog':
      return generateRequestSchema.parse({ ...base, kind: 'blog', topic: s.topic, count: s.count, length: s.length, tone: s.tone, keywords: [] });
  }
}

export interface AiSchedulerDeps {
  now?: () => number;
  log?: (msg: string, err?: unknown) => void;
  audit?: (action: string, target: string, detail?: string) => void;
}

/**
 * Cron-style schedules for the AI studio (docs/logic/ai-studio.md §Schedules): at each firing it does what an editor does by hand
 * (ask the model, then save the drafts) and keeps the outcome of the last run. Everything it saves is a draft / inactive / unapproved,
 * exactly like a manual save, so a human still reviews it.
 */
export class AiScheduler {
  private running = false;

  constructor(private readonly store: AiScheduleStore, private readonly studio: AiStudio, private readonly deps: AiSchedulerDeps = {}) {}

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  list(): Promise<ScheduleRow[]> {
    return this.store.list();
  }

  /** Checks an input and returns the first firing time (`null` while disabled), or the reason it cannot be kept. */
  private check(input: ScheduleInput): { next: number | null } | { error: ScheduleProblem } {
    const spec = parseCron(input.cron);
    if (!spec) return { error: 'invalid_cron' };
    const at = this.now();
    const first = nextCronRun(spec, at, AI_SCHEDULE_LIMITS.tzOffsetMinutes);
    if (first === null) return { error: 'never_runs' };
    const gap = minCronGapMinutes(spec, at, AI_SCHEDULE_LIMITS.tzOffsetMinutes);
    if (gap !== null && gap < AI_SCHEDULE_LIMITS.minIntervalMinutes) return { error: 'too_frequent' };
    if (input.count > AI_LIMITS.maxCount[input.kind]) return { error: 'count_too_high' };
    if (input.kind === 'blog' && input.topic.length < 3) return { error: 'topic_required' };
    if (!this.studio.describe().providers.some((p) => p.id === input.provider)) return { error: 'unknown_provider' };
    return { next: input.enabled ? first : null };
  }

  async create(input: ScheduleInput): Promise<ScheduleOutcome> {
    const c = this.check(input);
    if ('error' in c) return { ok: false, error: c.error };
    if ((await this.store.list()).length >= AI_SCHEDULE_LIMITS.maxSchedules) return { ok: false, error: 'too_many' };
    return { ok: true, row: await this.store.create(input, c.next) };
  }

  async update(id: string, input: ScheduleInput): Promise<ScheduleOutcome> {
    const c = this.check(input);
    if ('error' in c) return { ok: false, error: c.error };
    const row = await this.store.update(id, input, c.next);
    return row ? { ok: true, row } : { ok: false, error: 'not_found' };
  }

  remove(id: string): Promise<boolean> {
    return this.store.remove(id);
  }

  /** «اجرا همین الان»: runs once at once; the schedule's own next firing is left as it is. */
  async runNow(id: string): Promise<{ ok: true; row: ScheduleRow } | { ok: false; error: 'not_found' | 'busy' }> {
    const row = await this.store.get(id);
    if (!row) return { ok: false, error: 'not_found' };
    if (this.running) return { ok: false, error: 'busy' };
    this.running = true;
    try {
      await this.store.finish(id, await this.execute(row));
    } finally {
      this.running = false;
    }
    return { ok: true, row: (await this.store.get(id))! };
  }

  /** Runs every schedule that is due, one after another. Returns how many ran. */
  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let ran = 0;
    try {
      for (const row of await this.store.due(this.now())) {
        // The next firing is taken first: a run that crashes or takes minutes cannot make the same firing happen twice, and a server that was
        // down for a day runs the schedule once, not once per missed firing.
        const spec = parseCron(row.cron);
        const next = spec ? nextCronRun(spec, this.now(), AI_SCHEDULE_LIMITS.tzOffsetMinutes) : null;
        await this.store.setNext(row.id, next);
        await this.store.finish(row.id, await this.execute(row));
        ran += 1;
      }
    } finally {
      this.running = false;
    }
    return ran;
  }

  private async execute(row: ScheduleRow): Promise<RunResult> {
    const at = this.now();
    let result: RunResult;
    try {
      const gen = await this.studio.generate(requestFor(row));
      const save = saveSchema.safeParse({ kind: row.kind, drafts: gen.drafts, ...(row.kind === 'puzzle_groups' && row.tierId ? { tierId: row.tierId } : {}) });
      if (gen.drafts.length === 0) result = { at, status: 'empty', message: 'no_drafts', saved: 0 };
      else if (!save.success) result = { at, status: 'error', message: 'ai_bad_output', saved: 0 };
      else {
        const outcomes = await this.studio.save(save.data);
        const saved = outcomes.filter((o) => o.ok).length;
        const failed = outcomes.filter((o) => !o.ok);
        result = { at, status: saved > 0 ? 'ok' : 'error', message: failed.length ? `${failed.length} failed: ${failed.map((f) => f.error ?? '?').join(',')}` : '', saved };
      }
    } catch (err) {
      // Nothing to make (e.g. every kid item already has a lesson) is not a failure.
      if (err instanceof AiError && err.code === 'ai_not_found') result = { at, status: 'empty', message: 'nothing_to_do', saved: 0 };
      else {
        result = { at, status: 'error', message: err instanceof AiError ? err.code : 'unexpected', saved: 0 };
        this.deps.log?.(`ai schedule "${row.name}" failed`, err);
      }
    }
    this.deps.audit?.('ai.schedule.run', row.kind, `${row.name}: ${result.status} ×${result.saved}`);
    return result;
  }
}

export interface AiSchedulerHandle {
  stop(): void;
}

/** In-process loop: every `AI_SCHEDULE_LIMITS.tickSeconds` run what is due; a failing tick is logged and the loop goes on. */
export function startAiScheduler(opts: { scheduler: AiScheduler; log: (msg: string, err?: unknown) => void; setTimer?: typeof setTimeout }): AiSchedulerHandle {
  const setTimer = opts.setTimer ?? setTimeout;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    try {
      const ran = await opts.scheduler.tick();
      if (ran > 0) opts.log(`ai schedules: ran ${ran}`);
    } catch (err) {
      opts.log('ai schedules: tick failed', err);
    }
    if (!stopped) timer = setTimer(() => void tick(), AI_SCHEDULE_LIMITS.tickSeconds * 1000);
  };
  timer = setTimer(() => void tick(), 30_000);
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
