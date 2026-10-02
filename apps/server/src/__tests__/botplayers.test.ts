import { describe, expect, it } from 'vitest';
import { levelInfo, matchViewSchema, mulberry32 } from '@dozari/shared';
import { BotDriver } from '../botplayers/driver.js';
import { BotPlayerService } from '../botplayers/service.js';
import { createMemoryBotPlayerStore } from '../botplayers/store.js';
import { DuelQueue } from '../realtime/queue.js';
import { MatchService } from '../realtime/match-service.js';
import type { PuzzleSource, ServedPuzzle } from '../solo/types.js';

const xp = { soloBase: 5, duelBase: 10, winBonus: 15, curveBase: 50, levelMax: 50 };
const opts = { count: 10, levelMin: 3, levelMax: 12, skillMin: 30, skillMax: 80, winPercentMin: 40, winPercentMax: 65, thinkMinMs: 3000, thinkMaxMs: 12000, tauntPercent: 40, cityIds: ['c1', 'c2'] };

describe('generating bot players', () => {
  it('makes distinct, natural-looking accounts inside the asked ranges', async () => {
    const store = createMemoryBotPlayerStore();
    const after: string[] = [];
    const svc = new BotPlayerService(store, async () => xp, mulberry32(7), async (id) => void after.push(id));
    const { created } = await svc.generate(opts);
    expect(created).toHaveLength(10);
    expect(after).toEqual(created);
    const list = await svc.list();
    expect(new Set(list.map((b) => b.nickname)).size).toBe(10);
    for (const b of list) {
      expect(b.level).toBeGreaterThanOrEqual(3);
      expect(b.level).toBeLessThanOrEqual(12);
      expect(levelInfo(b.xp, xp).level).toBe(b.level);
      expect(b.skill).toBeGreaterThanOrEqual(30);
      expect(b.skill).toBeLessThanOrEqual(80);
      expect(b.wins).toBeLessThanOrEqual(b.games);
      expect(['c1', 'c2']).toContain(b.cityId);
      expect(b.coins).toBeGreaterThan(0);
      expect(b.coins % 10 === 0 && b.coins % 100 === 0).toBe(false);
      expect(b.thinkMaxMs).toBeGreaterThanOrEqual(b.thinkMinMs);
    }
    // A second batch never reuses a name.
    await svc.generate({ ...opts, count: 20 });
    expect(new Set((await svc.list()).map((b) => b.nickname)).size).toBe(30);
  });

  it('caps one call at 50, can pause a bot, and reports unknown ids', async () => {
    const store = createMemoryBotPlayerStore();
    const svc = new BotPlayerService(store, async () => xp, mulberry32(1));
    expect((await svc.generate({ ...opts, count: 500 })).created).toHaveLength(50);
    const id = (await svc.list())[0]!.userId;
    expect(await svc.update(id, { isActive: false, skill: 10 })).toBe('ok');
    expect((await store.active()).some((b) => b.userId === id)).toBe(false);
    expect(await svc.update('nope', { skill: 1 })).toBe('not_found');
  });
});

const puzzle: ServedPuzzle = {
  id: 'pz',
  groups: ([0, 1, 2, 3] as const).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`), titleFa: `عنوان ${level}`, explanationFa: `توضیح ${level}` })),
  items: Object.fromEntries([0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].map((i) => [`g${l}p${i}`, { nameFa: `کالا ${l}-${i}`, unitFa: null }]))),
};
const source: PuzzleSource = { pickRandom: async () => puzzle, pricesFor: async () => ({}) };

/** A fake world: a clock, a timer queue shared by the duel service and the driver, and every event sent to a user. */
async function world(botOver: Partial<{ skill: number; tauntPercent: number }> = {}) {
  const clock = { ms: 1_000_000 };
  const timers: { at: number; fn: () => void; live: boolean }[] = [];
  const sent: { to: string; event: string; payload: unknown }[] = [];
  const store = createMemoryBotPlayerStore();
  const botId = await store.create({ nickname: 'ربات‌آزمون', avatarKey: 'avatar-01', gender: null, cityId: null, skill: botOver.skill ?? 70, thinkMinMs: 2000, thinkMaxMs: 6000, tauntPercent: botOver.tauntPercent ?? 0, coins: 100, stats: { xp: 0, games: 0, wins: 0, losses: 0, draws: 0 } });
  const queue = new DuelQueue();
  const ended: { players: readonly [string, string]; winner: number | null }[] = [];
  let driver!: BotDriver;
  const matches = new MatchService({
    puzzles: source,
    profile: async (id) => ({ nickname: `n-${id}`, avatarKey: 'a', level: 1, coins: 0 }),
    emit: (to, event, payload) => {
      sent.push({ to, event, payload });
      driver.onEmit(to, event, payload);
    },
    now: () => clock.ms,
    newSeed: () => 5,
    schedule: (ms, fn) => {
      const t = { at: clock.ms + ms, fn, live: true };
      timers.push(t);
      return () => (t.live = false);
    },
    onEnded: ({ players, result }) => ended.push({ players, winner: result.winner }),
  });
  driver = new BotDriver({
    store,
    matches: () => matches,
    queue: () => queue,
    settings: async () => ({ enabled: true, fallbackSec: 25, jitterSec: 10, cityReplyPercent: 0 }),
    rng: mulberry32(9),
    now: () => clock.ms,
    schedule: (ms, fn) => {
      const t = { at: clock.ms + ms, fn, live: true };
      timers.push(t);
    },
  });
  await driver.refresh();
  const advance = (ms: number) => {
    clock.ms += ms;
    for (const t of timers.filter((x) => x.live && x.at <= clock.ms).sort((a, b) => a.at - b.at)) {
      t.live = false;
      t.fn();
    }
  };
  return { clock, queue, matches, driver, store, botId, sent, advance, ended };
}

describe('bot driver', () => {
  it('pairs a waiting human with a bot only after the wait, then the match starts', async () => {
    const w = await world();
    w.queue.join('human', w.clock.ms);
    await w.driver.tick();
    expect(w.matches.inMatch('human')).toBe(false); // not waited long enough
    w.clock.ms += 20_000;
    await w.driver.tick();
    expect(w.matches.inMatch('human')).toBe(false);
    w.clock.ms += 20_000; // past 25 s + the user's jitter (≤ 10 s)
    await w.driver.tick();
    expect(w.matches.inMatch('human')).toBe(true);
    expect(w.matches.inMatch(w.botId)).toBe(true);
    expect(w.queue.has('human')).toBe(false);
  });

  it('does nothing without bots, when switched off, or while every bot is busy', async () => {
    const w = await world();
    await w.store.update(w.botId, { isActive: false });
    await w.driver.refresh();
    w.queue.join('human', w.clock.ms);
    w.clock.ms += 60_000;
    await w.driver.tick();
    expect(w.queue.has('human')).toBe(true);
  });

  it('plays a whole match through the normal submit, never leaks a bot flag or the answer, and the match ends', async () => {
    const w = await world({ skill: 90 });
    w.queue.join('human', w.clock.ms);
    w.clock.ms += 40_000;
    await w.driver.tick();
    expect(w.matches.inMatch('human')).toBe(true);
    // The human only ever solves a group when it is their turn; the bot answers after its "thinking" pause.
    for (let step = 0; step < 80 && w.matches.inMatch('human'); step++) {
      const view = matchViewSchema.parse(w.sent.filter((s) => s.to === 'human' && s.event === 'match:state').at(-1)!.payload);
      if (view.status === 'finished') break;
      if (view.turn === view.you) {
        const sol = w.matches.solutionFor('human')!;
        expect(w.matches.submit('human', sol.groups[0]!).ok).toBe(true);
      }
      w.advance(8000);
    }
    expect(w.matches.inMatch('human')).toBe(false);
    expect(w.ended).toHaveLength(1);
    expect(w.ended[0]!.winner === 0 || w.ended[0]!.winner === 1 || w.ended[0]!.winner === null).toBe(true);
    const toHuman = JSON.stringify(w.sent.filter((s) => s.to === 'human'));
    expect(toHuman).not.toMatch(/is_bot|isBot|bot_/i);
    expect(w.sent.some((s) => s.to === w.botId && s.event === 'match:state')).toBe(true);
    // A bot that submitted shows up as guesses seen by the human.
    expect(w.sent.some((s) => s.to === 'human' && s.event === 'match:event' && (s.payload as { t: string }).t === 'guess')).toBe(true);
  });

  it('hands fill-in seats for a tournament only from idle active bots', async () => {
    const w = await world();
    expect(w.driver.fillSeats(3)).toEqual([w.botId]);
    w.queue.join('human', w.clock.ms);
    w.clock.ms += 40_000;
    await w.driver.tick();
    expect(w.driver.fillSeats(3)).toEqual([]); // the only bot is in a match now
    expect(w.driver.isBot(w.botId)).toBe(true);
    expect(w.driver.isBot('human')).toBe(false);
  });
});
