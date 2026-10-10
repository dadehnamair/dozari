import { describe, expect, it } from 'vitest';
import { AMBIENT_TABLE_FEE_MAX, mulberry32, tableMinEntry } from '@dozari/shared';
import { AmbientLobby } from '../tables/ambient.js';
import { TableService } from '../tables/service.js';

const BOTS = Array.from({ length: 40 }, (_, i) => ({ userId: `bot-${i}`, nickname: `ربات${i}`, avatarKey: 'avatar-01', level: 1 + i }));
const LEVELS: Record<string, number> = Object.fromEntries(BOTS.map((b) => [b.userId, b.level]));

function boot(settings = { enabled: true, open: 4, playing: 2 }) {
  const clock = { ms: Date.UTC(2026, 9, 7, 14, 30) }; // 18:00 in Tehran: a busy hour
  const inMatch = new Set<string>();
  const started: string[][] = [];
  const svc = new TableService({
    profileOf: async (id) => BOTS.find((b) => b.userId === id) ?? { nickname: `p-${id}`, avatarKey: 'avatar-01' },
    startMatch: async (a, b) => (started.push([a, b]), inMatch.add(a), inMatch.add(b), true),
    startTeam: async (sides) => (started.push(sides.flat()), sides.flat().forEach((u) => inMatch.add(u)), true),
    inMatch: (id) => inMatch.has(id),
    balanceOf: async (id) => (id.startsWith('bot') ? 0 : 1000),
    isBot: (id) => id.startsWith('bot'),
    idleMs: async () => 15 * 60_000,
    now: () => clock.ms,
    rng: mulberry32(3),
  });
  const lobby = new AmbientLobby({ tables: svc, roster: () => BOTS, inMatch: (id) => inMatch.has(id), settings: async () => settings, rng: mulberry32(9), now: () => clock.ms });
  const open = async () => (await svc.listPublic('human')).filter((x) => x.status === 'open');
  return { svc, lobby, clock, inMatch, started, settings, open };
}

describe('ambient lobby', () => {
  it('keeps the configured number of open bot tables, with distinct bots, and a few playing rows', async () => {
    const t = boot();
    await t.lobby.tick();
    await t.lobby.tick();
    const open = await t.open();
    expect(open).toHaveLength(4);
    expect(open.every((x) => x.taken >= 1 && x.taken < x.seats && x.entryFee >= tableMinEntry(x.rounds))).toBe(true);
    expect(new Set(open.map((x) => x.hostNickname)).size).toBe(4);
    // Bots-only tables really play (one new match per tick) and can be watched.
    const playing = (await t.svc.listPublic('human')).filter((x) => x.status === 'playing');
    expect(playing).toHaveLength(2);
    expect(playing.every((p) => p.taken === p.seats)).toBe(true);
    const w = await t.svc.watch('human', playing[0]!.code);
    const first = w.ok ? w.watchers : 0;
    expect(first).toBeGreaterThanOrEqual(1); // bots may sit in the stands too
    expect((await t.svc.watch('human2', playing[0]!.code)).ok && (await t.svc.listPublic('human')).find((x) => x.code === playing[0]!.code)?.watchers).toBe(first + 1);
    expect((await t.svc.watch('human', (await t.open())[0]!.code)).ok).toBe(false); // an open table has no match to watch
  });

  it('a person who asks for a seat is let in after a pause, the bots fill the rest and the match starts', async () => {
    const t = boot();
    await t.lobby.tick();
    await t.lobby.tick();
    const mine = () => t.started.filter((m) => m.includes('human'));
    const table = (await t.open()).find((x) => x.format === '2v2') ?? (await t.open())[0]!;
    expect((await t.svc.request('human', table.code)).ok).toBe(true);
    await t.lobby.tick();
    expect((await t.svc.mine('human'))).toBeNull(); // the bot has not answered yet
    t.clock.ms += 7000;
    await t.lobby.tick();
    expect((await t.svc.mine('human'))?.youAreIn).toBe(true);
    expect(mine()).toHaveLength(0); // the fill pause is not over yet
    t.clock.ms += 10_000;
    await t.lobby.tick();
    expect(mine()).toHaveLength(1);
    expect(new Set(mine()[0]).size).toBe(mine()[0]!.length);
    expect((await t.svc.mine('human'))?.inMatch).toBe(true);
    // Match over: the lobby table closes, shows as closed for a while, and the lobby is topped up again.
    for (const u of mine()[0]!) t.inMatch.delete(u);
    await t.lobby.tick();
    expect(await t.svc.mine('human')).toBeNull();
    expect(await t.open()).toHaveLength(4);
  });

  it('bots now and then watch running tables, a few at a time, and leave again', async () => {
    const t = boot();
    for (let i = 0; i < 12; i++) await t.lobby.tick();
    const playing = (await t.svc.listPublic('human')).filter((x) => x.status === 'playing');
    expect(playing.length).toBeGreaterThan(0);
    expect(playing.some((x) => x.watchers > 0)).toBe(true);
    expect(playing.every((x) => x.watchers <= 3)).toBe(true);
    t.clock.ms += 90_000;
    expect(t.svc.watcherIds(playing[0]!.code)).toHaveLength(0);
  });

  it('closes expired bot tables nobody asked for and opens new ones; shows nothing when switched off', async () => {
    const t = boot();
    await t.lobby.tick();
    const before = (await t.open()).map((x) => x.code);
    t.clock.ms += 6 * 60_000;
    await t.lobby.tick();
    const after = (await t.open()).map((x) => x.code);
    expect(after.some((c) => before.includes(c))).toBe(false);
    expect((await t.svc.listPublic('human')).some((x) => x.status === 'closed')).toBe(true);
    t.clock.ms += 6 * 60_000;
    t.settings.enabled = false;
    await t.lobby.tick();
    expect(await t.open()).toHaveLength(0); // the old ones expired and nothing new opens
  });

  it('a person who leaves before the pause ends cancels the start', async () => {
    const t = boot();
    await t.lobby.tick();
    const table = (await t.open())[0]!;
    await t.svc.join('human', table.code);
    t.svc.leave('human');
    t.clock.ms += 10_000;
    await t.lobby.tick();
    expect(t.started.flat()).not.toContain('human');
  });
});

describe('ambient rhythm and levels', () => {
  it('keeps fewer tables open in the small hours', async () => {
    const day = boot({ enabled: true, open: 10, playing: 0 });
    for (let i = 0; i < 8; i++) await day.lobby.tick();
    const night = boot({ enabled: true, open: 10, playing: 0 });
    night.clock.ms = Date.UTC(2026, 9, 7, 0, 30); // 04:00 in Tehran
    for (let i = 0; i < 8; i++) await night.lobby.tick();
    expect((await night.open()).length).toBeLessThan((await day.open()).length);
    expect((await night.open()).length).toBeGreaterThanOrEqual(1);
  });
  it('bots-only games pair bots of about one level', async () => {
    const t = boot({ enabled: true, open: 0, playing: 6 });
    for (let i = 0; i < 12; i++) await t.lobby.tick();
    const pairs = t.started.filter((m) => m.every((id) => id.startsWith('bot')));
    expect(pairs.length).toBeGreaterThan(0);
    const level = (id: string) => LEVELS[id] ?? 1;
    for (const m of pairs) expect(Math.max(...m.map(level)) - Math.min(...m.map(level))).toBeLessThanOrEqual(3);
  });
});

describe('ambient table fees', () => {
  it('ask a legal entry for their rounds, capped', async () => {
    const t = boot({ enabled: true, open: 8, playing: 2 });
    for (let i = 0; i < 6; i++) await t.lobby.tick();
    const rows = await t.svc.listPublic('human');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.entryFee).toBeGreaterThanOrEqual(tableMinEntry(r.rounds));
      expect(r.entryFee).toBeLessThanOrEqual(AMBIENT_TABLE_FEE_MAX);
    }
  });
});
