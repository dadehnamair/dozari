import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@dozari/shared';
import { AmbientLobby } from '../tables/ambient.js';
import { TableService } from '../tables/service.js';

const BOTS = Array.from({ length: 40 }, (_, i) => ({ userId: `bot-${i}`, nickname: `ربات${i}`, avatarKey: 'avatar-01' }));

function boot(settings = { enabled: true, open: 4, playing: 2 }) {
  const clock = { ms: 1_000_000 };
  const inMatch = new Set<string>();
  const started: string[][] = [];
  const svc = new TableService({
    profileOf: async (id) => BOTS.find((b) => b.userId === id) ?? { nickname: `p-${id}`, avatarKey: 'avatar-01' },
    startMatch: async (a, b) => (started.push([a, b]), inMatch.add(a), inMatch.add(b), true),
    startTeam: async (sides) => (started.push(sides.flat()), sides.flat().forEach((u) => inMatch.add(u)), true),
    inMatch: (id) => inMatch.has(id),
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
    expect(open.every((x) => x.taken >= 1 && x.taken < x.seats && x.entryFee === 0)).toBe(true);
    expect(new Set(open.map((x) => x.hostNickname)).size).toBe(4);
    const playing = t.lobby.playingRows();
    expect(playing).toHaveLength(2);
    expect(playing.every((p) => p.status === 'playing' && p.taken === p.seats)).toBe(true);
  });

  it('a person who asks for a seat is let in after a pause, the bots fill the rest and the match starts', async () => {
    const t = boot();
    await t.lobby.tick();
    await t.lobby.tick();
    const table = (await t.open()).find((x) => x.format === '2v2') ?? (await t.open())[0]!;
    expect((await t.svc.request('human', table.code)).ok).toBe(true);
    await t.lobby.tick();
    expect((await t.svc.mine('human'))).toBeNull(); // the bot has not answered yet
    t.clock.ms += 7000;
    await t.lobby.tick();
    expect((await t.svc.mine('human'))?.youAreIn).toBe(true);
    expect(t.started).toHaveLength(0); // the fill pause is not over yet
    t.clock.ms += 10_000;
    await t.lobby.tick();
    expect(t.started).toHaveLength(1);
    expect(t.started[0]).toContain('human');
    expect(new Set(t.started[0]).size).toBe(t.started[0]!.length);
    expect((await t.svc.mine('human'))?.inMatch).toBe(true);
    // Match over: the lobby table closes, shows as closed for a while, and the lobby is topped up again.
    for (const u of t.started[0]!) t.inMatch.delete(u);
    await t.lobby.tick();
    expect(await t.svc.mine('human')).toBeNull();
    expect(await t.open()).toHaveLength(4);
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
    t.settings.enabled = false;
    await t.lobby.tick();
    expect(t.lobby.playingRows()).toHaveLength(0);
  });

  it('a person who leaves before the pause ends cancels the start', async () => {
    const t = boot();
    await t.lobby.tick();
    const table = (await t.open())[0]!;
    await t.svc.join('human', table.code);
    t.svc.leave('human');
    t.clock.ms += 10_000;
    await t.lobby.tick();
    expect(t.started).toHaveLength(0);
  });
});
