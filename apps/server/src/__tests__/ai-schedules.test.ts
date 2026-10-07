import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { AiStudio } from '../ai/studio.js';
import { AiScheduler, createMemoryAiScheduleStore, requestFor, scheduleInputSchema, startAiScheduler } from '../ai/schedules.js';
import type { FetchLike } from '../ai/providers.js';
import type { ProductAdmin } from '../admin/products.js';
import type { LessonStore } from '../lessons/service.js';
import { createMemoryAuditLog } from '../admin/audit.js';

const TOKEN = 'secret-admin-token';
const h = { 'x-admin-token': TOKEN };
const PID = '0190a000-0000-7000-8000-000000000001';
// 2026-10-07 12:00 in Tehran (UTC+3:30).
const T0 = Date.UTC(2026, 9, 7, 8, 30);

const lessonAnswer = JSON.stringify({ items: [{ productId: PID, wordFa: 'سیب', storyFa: 'سیب خوشمزه است', syllablesFa: 'سی-ب' }] });
const answer = (content: string): FetchLike => async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) });

function setup(fetchImpl: FetchLike = answer(lessonAnswer), kidItems = 1) {
  const saved: unknown[] = [];
  const lessons = {
    listKidItems: async () => (kidItems ? [{ productId: PID, nameFa: 'سیب', iconKey: null, lesson: null }] : []),
    save: async (id: string, input: unknown) => (saved.push([id, input]), true),
  } as unknown as LessonStore;
  const products: ProductAdmin = { details: async () => ({}), update: async () => 'ok', create: async () => ({ id: PID }), addPrice: async () => ({ id: PID }) };
  const studio = new AiStudio({ env: { AI_DEEPSEEK_API_KEY: 'sk-test-key' }, lessons, products, fetch: fetchImpl });
  let clock = T0;
  const audit = createMemoryAuditLog();
  const store = createMemoryAiScheduleStore(() => clock);
  const logs: string[] = [];
  const scheduler = new AiScheduler(store, studio, { now: () => clock, log: (m) => logs.push(m), audit: (a, t, d) => void audit.record(a, t, d) });
  return { scheduler, store, saved, logs, audit, studio, advance: (ms: number) => (clock += ms), app: () => buildServer({ admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: TOKEN }, adminModules: { ai: studio, aiSchedules: scheduler, audit } }) };
}

const input = (over: Record<string, unknown> = {}) => scheduleInputSchema.parse({ name: 'درس‌های روزانه', kind: 'kid_lessons', cron: '0 9 * * *', provider: 'deepseek', count: 3, ...over });

describe('AI schedules: validation', () => {
  it('keeps only sane schedules and tells why not', async () => {
    const { scheduler } = setup();
    expect(await scheduler.create(input({ cron: 'whenever' }))).toEqual({ ok: false, error: 'invalid_cron' });
    expect(await scheduler.create(input({ cron: '*/5 * * * *' }))).toEqual({ ok: false, error: 'too_frequent' });
    expect(await scheduler.create(input({ cron: '0 0 30 2 *' }))).toEqual({ ok: false, error: 'never_runs' });
    expect(await scheduler.create(input({ provider: 'nope' }))).toEqual({ ok: false, error: 'unknown_provider' });
    expect(await scheduler.create(input({ kind: 'blog', topic: '' }))).toEqual({ ok: false, error: 'topic_required' });
    expect(await scheduler.create(input({ kind: 'puzzle_groups', count: 9 }))).toEqual({ ok: false, error: 'count_too_high' });
    const ok = await scheduler.create(input());
    expect(ok.ok && ok.row.nextRunAt).toBe(Date.UTC(2026, 9, 8, 5, 30)); // 09:00 Tehran tomorrow
  });

  it('a disabled schedule has no next firing', async () => {
    const { scheduler } = setup();
    const out = await scheduler.create(input({ enabled: false }));
    expect(out.ok && out.row.nextRunAt).toBeNull();
  });

  it('builds the same request a manual run sends', () => {
    expect(requestFor(input({ kind: 'puzzle_groups', count: 2, ageTrack: 'kid', style: 'plain', model: 'm1', hint: 'ورزش' }))).toEqual({ kind: 'puzzle_groups', provider: 'deepseek', model: 'm1', hint: 'ورزش', count: 2, ageTrack: 'kid', style: 'plain' });
    expect(requestFor(input({ kind: 'blog', topic: 'قیمت نان' }))).toMatchObject({ kind: 'blog', topic: 'قیمت نان', keywords: [] });
  });
});

describe('AI schedules: running', () => {
  it('runs a due schedule once, saves the drafts and moves to the next day', async () => {
    const { scheduler, advance, saved, audit } = setup();
    const made = await scheduler.create(input());
    if (!made.ok) throw new Error('create failed');
    expect(await scheduler.tick()).toBe(0);
    advance(21 * 3_600_000); // 09:00 next day
    expect(await scheduler.tick()).toBe(1);
    expect(saved).toHaveLength(1);
    const [row] = await scheduler.list();
    expect(row).toMatchObject({ lastStatus: 'ok', lastSaved: 1, lastRunAt: T0 + 21 * 3_600_000, nextRunAt: Date.UTC(2026, 9, 9, 5, 30) });
    expect(await scheduler.tick()).toBe(0);
    expect((await audit.recent(10)).some((e) => e.action === 'ai.schedule.run')).toBe(true);
  });

  it('after downtime a schedule runs once, not once per missed firing', async () => {
    const { scheduler, advance, saved } = setup();
    await scheduler.create(input());
    advance(5 * 24 * 3_600_000);
    expect(await scheduler.tick()).toBe(1);
    expect(saved).toHaveLength(1);
    expect((await scheduler.list())[0]!.nextRunAt).toBeGreaterThan(T0 + 5 * 24 * 3_600_000);
  });

  it('a disabled or not yet due schedule never runs', async () => {
    const { scheduler, advance } = setup();
    await scheduler.create(input({ enabled: false }));
    await scheduler.create(input({ name: 'later', cron: '0 23 * * *' }));
    advance(2 * 3_600_000);
    expect(await scheduler.tick()).toBe(0);
  });

  it('records a provider failure and keeps the schedule going', async () => {
    const { scheduler, advance, logs } = setup(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    await scheduler.create(input());
    advance(24 * 3_600_000);
    expect(await scheduler.tick()).toBe(1);
    const [row] = await scheduler.list();
    expect(row).toMatchObject({ lastStatus: 'error', lastMessage: 'ai_http_error', lastSaved: 0 });
    expect(row!.nextRunAt).toBeGreaterThan(T0 + 24 * 3_600_000);
    expect(logs).toHaveLength(1);
  });

  it('nothing to make is «empty», not an error', async () => {
    const { scheduler, advance, logs } = setup(answer(lessonAnswer), 0);
    await scheduler.create(input());
    advance(24 * 3_600_000);
    await scheduler.tick();
    expect((await scheduler.list())[0]).toMatchObject({ lastStatus: 'empty', lastMessage: 'nothing_to_do' });
    expect(logs).toHaveLength(0);
  });

  it('«run now» runs at once and leaves the next firing alone', async () => {
    const { scheduler, saved } = setup();
    const made = await scheduler.create(input());
    if (!made.ok) throw new Error('create failed');
    const out = await scheduler.runNow(made.row.id);
    expect(out.ok && out.row).toMatchObject({ lastStatus: 'ok', nextRunAt: made.row.nextRunAt });
    expect(saved).toHaveLength(1);
    expect(await scheduler.runNow('missing')).toEqual({ ok: false, error: 'not_found' });
  });

  it('the loop ticks on a timer and stops', async () => {
    const { scheduler, advance, saved } = setup();
    await scheduler.create(input());
    advance(24 * 3_600_000);
    const timers: (() => void)[] = [];
    const handle = startAiScheduler({ scheduler, log: () => undefined, setTimer: ((fn: () => void) => (timers.push(fn), timers.length)) as unknown as typeof setTimeout });
    timers.shift()!();
    await new Promise((r) => setTimeout(r, 20));
    expect(saved).toHaveLength(1);
    expect(timers).toHaveLength(1); // re-armed
    handle.stop();
  });
});

describe('AI schedules: admin routes', () => {
  it('creates, lists, runs, edits and deletes', async () => {
    const { app: build, saved } = setup();
    const app = build();
    const body = { name: 'درس‌ها', kind: 'kid_lessons', cron: '0 9 * * *', provider: 'deepseek', count: 3 };
    expect((await app.inject({ method: 'POST', url: '/admin/ai/schedules', payload: body })).statusCode).toBe(401);
    const bad = await app.inject({ method: 'POST', url: '/admin/ai/schedules', headers: h, payload: { ...body, cron: '* * * * *' } });
    expect([bad.statusCode, bad.json()]).toEqual([400, { error: 'too_frequent' }]);
    const created = (await app.inject({ method: 'POST', url: '/admin/ai/schedules', headers: h, payload: body })).json() as { schedule: { id: string; nextRunAt: number } };
    const listed = (await app.inject({ method: 'GET', url: '/admin/ai/schedules', headers: h })).json() as { schedules: unknown[]; limits: { minIntervalMinutes: number } };
    expect(listed.schedules).toHaveLength(1);
    expect(listed.limits.minIntervalMinutes).toBe(15);
    const ran = await app.inject({ method: 'POST', url: `/admin/ai/schedules/${created.schedule.id}/run`, headers: h });
    expect(ran.json()).toMatchObject({ schedule: { lastStatus: 'ok' } });
    expect(saved).toHaveLength(1);
    const edited = await app.inject({ method: 'PUT', url: `/admin/ai/schedules/${created.schedule.id}`, headers: h, payload: { ...body, enabled: false } });
    expect(edited.json()).toMatchObject({ schedule: { enabled: false, nextRunAt: null } });
    expect((await app.inject({ method: 'DELETE', url: `/admin/ai/schedules/${created.schedule.id}`, headers: h })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/admin/ai/schedules/${created.schedule.id}`, headers: h })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PUT', url: '/admin/ai/schedules/nope', headers: h, payload: body })).statusCode).toBe(404);
  });
});
