import { afterEach, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { DEFAULT_MATCH_RULES, TURN_SECONDS, draftViewSchema, matchEndedSchema, matchFoundSchema, matchViewSchema, mulberry32 } from '@dozari/shared';
import type { MatchRules, MatchView } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { PuzzleHistory } from '../solo/history.js';
import { MatchService } from '../realtime/match-service.js';
import type { PlayerProfile } from '../realtime/match-service.js';
import type { PuzzleSource, ServedPuzzle } from '../solo/types.js';

const puzzle: ServedPuzzle = {
  id: 'pz1',
  groups: ([0, 1, 2, 3] as const).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`), titleFa: `عنوان ${level}`, explanationFa: `توضیح ${level}` })),
  items: Object.fromEntries([0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].map((i) => [`g${l}p${i}`, { nameFa: `کالا ${l}-${i}`, unitFa: null }]))),
};
const ids = (level: number) => [0, 1, 2, 3].map((i) => `g${level}p${i}`);
const source: PuzzleSource = { pickRandom: async () => puzzle, pricesFor: async () => ({}) };
const profile = async (userId: string): Promise<PlayerProfile> => ({ nickname: `n-${userId}`, avatarKey: 'a', level: 1, coins: 0 });

/** Fake clock: timers fire only when the test says so. */
function harness(rules?: () => Promise<MatchRules>, onLeave?: NonNullable<ConstructorParameters<typeof MatchService>[0]['onLeave']>, items?: { stock: Record<string, { shuffle: number; reveal: number }>; consumed: string[] }) {
  let t = 1_000_000;
  const timers: { at: number; fn: () => void; live: boolean }[] = [];
  const sent: { to: string; event: string; payload: unknown }[] = [];
  const svc = new MatchService({
    puzzles: source,
    profile,
    rules,
    onLeave,
    itemsOf: items ? async (ids) => Object.fromEntries(ids.map((id) => [id, items.stock[id] ?? { shuffle: 0, reveal: 0 }])) : undefined,
    consumeItem: items ? async (id, effect) => (items.consumed.push(`${id}:${effect}`), true) : undefined,
    emit: (to, event, payload) => sent.push({ to, event, payload }),
    now: () => t,
    newSeed: () => 5,
    schedule: (ms, fn) => {
      const timer = { at: t + ms, fn, live: true };
      timers.push(timer);
      return () => (timer.live = false);
    },
  });
  const advance = (ms: number) => {
    t += ms;
    for (const timer of timers.filter((x) => x.live && x.at <= t)) {
      timer.live = false;
      timer.fn();
    }
  };
  const last = (to: string, event: string) => sent.filter((s) => s.to === to && s.event === event).at(-1)?.payload;
  return { svc, sent, advance, last };
}

describe('MatchService, timeouts with separate boards', () => {
  it('tells only the side that ran out of time, costs it a mistake and does not give the rival a win', async () => {
    const { svc, sent, last, advance } = harness(async () => ({ ...DEFAULT_MATCH_RULES, separateBoards: true }));
    await svc.start('A', 'B');
    const first = matchViewSchema.parse(last('A', 'match:state'));
    const slow = first.turn === 0 ? 'A' : 'B';
    const other = slow === 'A' ? 'B' : 'A';
    sent.length = 0;
    advance(TURN_SECONDS * 1000 + 1);
    const events = (to: string) => sent.filter((x) => x.to === to && x.event === 'match:event').map((x) => (x.payload as { t: string }).t);
    expect(events(slow)).toContain('timeout');
    expect(events(other)).not.toContain('timeout');
    const v = matchViewSchema.parse(last(other, 'match:state'));
    expect(v.mistakes[first.turn]).toBe(1);
    expect(v.status).toBe('playing');
  });
});

describe('MatchService, topic draft', () => {
  /** A source with a puzzle per topic, so each round has its own board. */
  const topicList = [{ id: 't-food', nameFa: 'خوراکی' }, { id: 't-tools', nameFa: 'ابزار' }, { id: 't-kitchen', nameFa: 'آشپزخانه' }, { id: 't-toys', nameFa: 'اسباب‌بازی' }];
  const asked: (string | undefined)[] = [];
  const topicSource: PuzzleSource = {
    pickRandom: async (o) => {
      asked.push(o?.topicId);
      return { ...puzzle, id: `pz-${o?.topicId ?? 'any'}-${(o?.exclude ?? []).length}` };
    },
    pricesFor: async () => ({}),
  };
  function draftHarness(bots: string[] = []) {
    let t = 1_000_000;
    const timers: { at: number; fn: () => void; live: boolean }[] = [];
    const sent: { to: string; event: string; payload: unknown }[] = [];
    const svc = new MatchService({
      puzzles: topicSource,
      profile,
      topics: async () => topicList,
      topicDraft: async () => true,
      isBot: (id) => bots.includes(id),
      emit: (to, event, payload) => sent.push({ to, event, payload }),
      now: () => t,
      newSeed: () => 5,
      schedule: (ms, fn) => {
        const timer = { at: t + ms, fn, live: true };
        timers.push(timer);
        return () => (timer.live = false);
      },
    });
    const advance = async (ms: number) => {
      t += ms;
      for (const timer of timers.filter((x) => x.live && x.at <= t)) {
        timer.live = false;
        timer.fn();
      }
      await new Promise((r) => setTimeout(r, 0));
    };
    const draft = (to: string) => draftViewSchema.parse(sent.filter((x) => x.to === to && x.event === 'draft:state').at(-1)?.payload);
    return { svc, sent, advance, draft };
  }

  it('lets the sides name a topic each, closes used topics, draws the last odd round and then starts the match', async () => {
    asked.length = 0;
    const { svc, sent, draft } = draftHarness();
    expect(await svc.start('A', 'B', { boards: 3 })).toBe(true);
    expect(svc.inMatch('A') && svc.inMatch('B')).toBe(true); // drafting players cannot queue again
    const first = draft('A');
    expect(first.status).toBe('picking');
    expect(first.rounds).toBe(3);
    const picker = first.yourTurn ? 'A' : 'B';
    const other = picker === 'A' ? 'B' : 'A';
    expect(svc.pickTopic(other, 't-food')).toEqual({ ok: false, error: 'NOT_YOUR_PICK' });
    expect(svc.pickTopic(picker, 'nope')).toEqual({ ok: false, error: 'UNKNOWN_TOPIC' });
    expect(svc.pickTopic(picker, 't-tools')).toEqual({ ok: true });
    expect(draft(other).yourTurn).toBe(true);
    expect(draft(other).open.map((o) => o.id)).not.toContain('t-tools');
    expect(svc.pickTopic(other, 'random')).toEqual({ ok: true });
    await new Promise((r) => setTimeout(r, 5));
    // round 3 was the system's: the draft is over and the match began on three boards
    expect(svc.activeCount).toBe(1);
    const view = matchViewSchema.parse(sent.filter((x) => x.to === 'A' && x.event === 'match:state').at(-1)?.payload);
    expect(view.rounds).toBe(3);
    expect(view.topics).toHaveLength(3);
    expect(view.topics![0]).toBe('ابزار');
    expect(new Set(view.topics).size).toBe(3);
    expect(asked.filter(Boolean)).toContain('t-tools');
  });

  it('draws for a chooser who does not answer in time, and for a bot chooser right away', async () => {
    const slow = draftHarness();
    await slow.svc.start('A', 'B', { boards: 3 });
    await slow.advance(21_000);
    expect(slow.draft('A').picked).toHaveLength(1);
    expect(slow.draft('A').picked[0]!.by).toBe('timeout');
    await slow.advance(21_000);
    expect(slow.svc.activeCount).toBe(1);

    const bot = draftHarness(['B']);
    await bot.svc.start('A', 'B', { boards: 3 });
    for (let i = 0; i < 4 && bot.svc.activeCount === 0; i++) {
      const v = bot.draft('A');
      if (v.yourTurn) expect(bot.svc.pickTopic('A', 'random')).toEqual({ ok: true });
      await bot.advance(5_000);
    }
    expect(bot.svc.activeCount).toBe(1);
  });

  it('leaving during the draft cancels it for both without a match, and one or two rounds skip the draft', async () => {
    const { svc, sent, draft } = draftHarness();
    await svc.start('A', 'B', { boards: 3 });
    expect(svc.leave('A')).toEqual({ ok: true });
    expect(draft('B').status).toBe('cancelled');
    expect(svc.activeCount).toBe(0);
    expect(svc.inMatch('A') || svc.inMatch('B')).toBe(false);

    sent.length = 0;
    await svc.start('A', 'B', { boards: 2 });
    expect(sent.some((x) => x.event === 'draft:state')).toBe(false);
    expect(svc.activeCount).toBe(1);
  });

  it('in a 2v2 the four take turns naming a topic (A1, B1, A2, B2…), only the one whose turn it is may pick, then the team match starts', async () => {
    const { svc, sent, draft } = draftHarness();
    const all = ['a1', 'b1', 'a2', 'b2'];
    expect(await svc.startTeam([['a1', 'a2'], ['b1', 'b2']], { boards: 4 })).toBe(true);
    for (const u of all) expect(svc.inMatch(u)).toBe(true);
    const order: string[] = [];
    for (let round = 0; round < 4; round++) {
      const v = draft('a1');
      expect(v.status).toBe('picking');
      const chooser = all.find((u) => draft(u).yourTurn)!;
      expect(draft(chooser).chooserId).toBe(chooser);
      expect(all.filter((u) => draft(u).yourTurn)).toHaveLength(1);
      expect(draft(all.find((u) => u !== chooser)!).chooserName).toBeTruthy();
      const partner = chooser.startsWith('a') ? (chooser === 'a1' ? 'a2' : 'a1') : chooser === 'b1' ? 'b2' : 'b1';
      expect(svc.pickTopic(partner, topicList[round]!.id)).toEqual({ ok: false, error: 'NOT_YOUR_PICK' });
      expect(svc.pickTopic(chooser, topicList[round]!.id)).toEqual({ ok: true });
      order.push(chooser);
      if (round < 3) await Promise.resolve();
    }
    await new Promise((r) => setTimeout(r, 5));
    // sides alternate and inside a side the two members take their turns: x1, y1, x2, y2
    expect(order[0]![0]).not.toBe(order[1]![0]);
    expect(order[0]![0]).toBe(order[2]![0]);
    expect(order[0]).not.toBe(order[2]);
    expect(order[1]).not.toBe(order[3]);
    expect(svc.activeCount).toBe(1);
    const view = matchViewSchema.parse(sent.filter((x) => x.to === 'a2' && x.event === 'match:state').at(-1)?.payload);
    expect(view.team).toBe(true);
    expect(view.topics).toEqual(topicList.map((t) => t.nameFa));
  });
});

describe('MatchService, bought items', () => {
  const sepRules = async () => ({ ...DEFAULT_MATCH_RULES, separateBoards: true });

  it('shuffle re-orders only the rival\'s cards, tells the rival it happened and takes one item from the inventory', async () => {
    const items = { stock: { A: { shuffle: 1, reveal: 0 }, B: { shuffle: 0, reveal: 0 } }, consumed: [] as string[] };
    const { svc, sent, last } = harness(sepRules, undefined, items);
    await svc.start('A', 'B');
    const before = matchViewSchema.parse(last('B', 'match:state'));
    expect(matchViewSchema.parse(last('A', 'match:state')).items).toEqual({ shuffle: 1, reveal: 0 });
    sent.length = 0;
    expect(await svc.useItem('A', 'shuffle')).toEqual({ ok: true });
    expect(items.consumed).toEqual(['A:shuffle_rival']);
    const after = matchViewSchema.parse(last('B', 'match:state'));
    expect(after.cards.map((c) => c.id).sort()).toEqual(before.cards.map((c) => c.id).sort());
    expect(after.cards.map((c) => c.id)).not.toEqual(before.cards.map((c) => c.id));
    expect(matchViewSchema.parse(last('A', 'match:state')).items).toEqual({ shuffle: 0, reveal: 0 });
    const toB = sent.filter((x) => x.to === 'B' && x.event === 'match:event').map((x) => x.payload as { t: string; kind?: string });
    expect(toB).toContainEqual({ t: 'power', side: 0, kind: 'shuffle' });
    // a second use is refused and takes nothing
    expect(await svc.useItem('A', 'shuffle')).toEqual({ ok: false, error: 'NO_POWER' });
    expect(items.consumed).toHaveLength(1);
  });

  it('reveal shows the four cards of an open group to the user alone', async () => {
    const items = { stock: { A: { shuffle: 0, reveal: 1 }, B: { shuffle: 0, reveal: 1 } }, consumed: [] as string[] };
    const { svc, sent, last } = harness(sepRules, undefined, items);
    await svc.start('A', 'B');
    const mover = matchViewSchema.parse(last('A', 'match:state')).turn === 0 ? 'A' : 'B';
    const other = mover === 'A' ? 'B' : 'A';
    sent.length = 0;
    expect(await svc.useItem(other, 'reveal')).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
    expect(items.consumed).toEqual([]); // refused before anything was taken
    expect(await svc.useItem(mover, 'reveal')).toEqual({ ok: true });
    const own = sent.filter((x) => x.to === mover && x.event === 'match:event').map((x) => x.payload as { t: string; itemIds?: string[] });
    expect(own.find((e) => e.t === 'power')?.itemIds).toHaveLength(4);
    const theirs = sent.filter((x) => x.to === other && x.event === 'match:event').map((x) => x.payload as { t: string; itemIds?: string[] });
    expect(theirs.find((e) => e.t === 'power')?.itemIds).toBeUndefined();
  });

  it('without stock nothing is taken', async () => {
    const items = { stock: {}, consumed: [] as string[] };
    const { svc } = harness(sepRules, undefined, items);
    await svc.start('A', 'B');
    expect(await svc.useItem('A', 'shuffle')).toEqual({ ok: false, error: 'NO_POWER' });
  });
});

describe('MatchService, leave log', () => {
  it('logs a leave of a running board with its kind, and never a leave after the match ended', async () => {
    const seen: { userId: string; kind: string }[] = [];
    const { svc } = harness(undefined, (i) => seen.push({ userId: i.userId, kind: i.kind }));
    await svc.start('A', 'B');
    expect(svc.leave('A', 'absent')).toEqual({ ok: true });
    expect(seen).toEqual([{ userId: 'A', kind: 'absent' }]);
    expect(svc.leave('B')).toEqual({ ok: false, error: 'NOT_IN_MATCH' }); // the match ended by A's forfeit; B is free
    expect(seen).toHaveLength(1);
  });
});

describe('MatchService, separate boards', () => {
  it('tells the rival only how many groups were found, never the cards, the guess or its result', async () => {
    const { svc, sent, last } = harness(async () => ({ ...DEFAULT_MATCH_RULES, separateBoards: true }));
    await svc.start('A', 'B');
    const va = matchViewSchema.parse(last('A', 'match:state'));
    const mover = va.turn === 0 ? 'A' : 'B';
    const other = mover === 'A' ? 'B' : 'A';
    sent.length = 0;
    expect(await svc.submit(mover, ids(0))).toEqual({ ok: true });
    const mine = matchViewSchema.parse(last(mover, 'match:state'));
    const theirs = matchViewSchema.parse(last(other, 'match:state'));
    expect(mine.solved).toHaveLength(1);
    expect(theirs.solved).toHaveLength(0);
    expect(theirs.cards).toHaveLength(16);
    expect(mine.found?.[mine.you]).toBe(1);
    expect(theirs.found?.[mine.you]).toBe(1);
    const toRival = sent.filter((x) => x.to === other && x.event === 'match:event').map((x) => x.payload as { t: string });
    expect(toRival.map((e) => e.t)).toContain('found');
    expect(toRival.map((e) => e.t)).not.toContain('guess');
    expect(toRival.map((e) => e.t)).not.toContain('group_solved');
    expect(JSON.stringify(toRival)).not.toContain('g0p');
  });
});

describe('MatchService', () => {
  it('starts a match, tells both players and never exposes unsolved groups', async () => {
    const { svc, sent, last } = harness();
    expect(await svc.start('A', 'B')).toBe(true);
    expect(svc.activeCount).toBe(1);
    expect(matchFoundSchema.safeParse(last('A', 'match:found')).success).toBe(true);
    const va = matchViewSchema.parse(last('A', 'match:state'));
    const vb = matchViewSchema.parse(last('B', 'match:state'));
    expect([va.you, vb.you]).toEqual([0, 1]);
    expect(va.cards).toHaveLength(16);
    expect(JSON.stringify(sent)).not.toContain('عنوان');
    expect(JSON.stringify(sent)).not.toContain('is_bot');
  });

  it('power-ups: the magnifier\'s two cards reach only the user, the rival just sees that it was used, and a freeze stops the player to move from selecting for a few seconds', async () => {
    const { svc, sent, last, advance } = harness();
    await svc.start('A', 'B');
    const va = matchViewSchema.parse(last('A', 'match:state'));
    const first = va.turn === 0 ? 'A' : 'B';
    const second = first === 'A' ? 'B' : 'A';
    expect(svc.power(second, 'magnifier')).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
    sent.length = 0;
    expect(svc.power(first, 'magnifier')).toEqual({ ok: true });
    const mine = sent.find((m) => m.to === first && m.event === 'match:event')!.payload as { t: string; itemIds?: string[] };
    const theirs = sent.find((m) => m.to === second && m.event === 'match:event')!.payload as { t: string; itemIds?: string[] };
    expect(mine.itemIds).toHaveLength(2);
    expect(theirs).toMatchObject({ t: 'power', kind: 'magnifier' });
    expect(theirs.itemIds).toBeUndefined();
    expect(matchViewSchema.parse(last(first, 'match:state')).powers).toEqual({ magnifier: 1, freeze: 1 });
    // one power-up per player per match, whatever is left in the bag
    expect(matchViewSchema.parse(last(first, 'match:state')).powerUsed).toBe(true);
    expect(svc.power(first, 'magnifier')).toEqual({ ok: false, error: 'POWER_USED' });

    // the rival freezes the player to move: no selecting or submitting until the freeze ends
    expect(svc.power(first, 'freeze')).toEqual({ ok: false, error: 'POWER_USED' });
    expect(svc.power(second, 'freeze')).toEqual({ ok: true });
    const wrong = [ids(0)[0]!, ids(0)[1]!, ids(1)[0]!, ids(1)[1]!];
    expect(svc.submit(first, wrong)).toEqual({ ok: false, error: 'FROZEN' });
    const until = matchViewSchema.parse(last(first, 'match:state')).frozenUntil![first === 'A' ? 0 : 1];
    expect(until).toBeGreaterThan(0);
    advance(10_000);
    expect(svc.submit(first, wrong)).toEqual({ ok: true });
  });

  it('refuses a second match for a busy player or a lone pair', async () => {
    const { svc } = harness();
    expect(await svc.start('A', 'A')).toBe(false);
    await svc.start('A', 'B');
    expect(await svc.start('A', 'C')).toBe(false);
  });

  it('enforces turns, scores a correct group and keeps the turn', async () => {
    const { svc, last } = harness();
    await svc.start('A', 'B');
    const v = matchViewSchema.parse(last('A', 'match:state'));
    const [first, second] = v.turn === 0 ? (['A', 'B'] as const) : (['B', 'A'] as const);
    expect(svc.submit(second, ids(0))).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
    expect(svc.submit(first, ['g0p0', 'g0p1'])).toEqual({ ok: false, error: 'INVALID_SELECTION' });
    expect(svc.submit(first, ids(0))).toEqual({ ok: true });
    const after = matchViewSchema.parse(last(first, 'match:state')) as MatchView;
    expect(after.solved).toHaveLength(1);
    expect(after.solved[0]).toMatchObject({ level: 0, titleFa: 'عنوان 0', by: after.you });
    expect(after.turn).toBe(after.you);
    expect(after.scores[after.you]).toBeGreaterThan(0);
    expect(svc.submit(first, ids(0))).toEqual({ ok: false, error: 'INVALID_SELECTION' }); // already off the board
    expect(svc.submit('Z', ids(1))).toEqual({ ok: false, error: 'NOT_IN_MATCH' });
  });

  it('passes the turn on a wrong guess and on the turn clock, and forfeits an AFK player', async () => {
    const { svc, advance, last } = harness();
    await svc.start('A', 'B');
    const start = matchViewSchema.parse(last('A', 'match:state'));
    const first = start.turn === 0 ? 'A' : 'B';
    const mix = [ids(0)[0]!, ids(0)[1]!, ids(1)[0]!, ids(1)[1]!];
    svc.submit(first, mix);
    const afterWrong = matchViewSchema.parse(last('A', 'match:state'));
    expect(afterWrong.turn).not.toBe(start.turn);
    expect(afterWrong.mistakes[start.turn]).toBe(1);

    // Nobody moves: turn passes on each timeout, and the first side to time out twice in a row loses.
    advance(TURN_SECONDS * 1000 + 1);
    advance(TURN_SECONDS * 1000 + 1);
    advance(TURN_SECONDS * 1000 + 1);
    const ended = matchEndedSchema.parse(last('A', 'match:ended'));
    expect(ended.result.reason).toBe('forfeit');
    expect(ended.groups).toHaveLength(4);
    expect(svc.activeCount).toBe(0);
    expect(svc.inMatch('A')).toBe(false);
  });

  it('ends the match when a player leaves and lets them queue again', async () => {
    const { svc, last } = harness();
    await svc.start('A', 'B');
    expect(svc.leave('A')).toEqual({ ok: true });
    const ended = matchEndedSchema.parse(last('B', 'match:ended'));
    expect(ended.result).toEqual({ winner: 1, reason: 'abandon' });
    expect(svc.leave('A')).toEqual({ ok: false, error: 'NOT_IN_MATCH' });
    expect(await svc.start('A', 'B')).toBe(true);
  });

  it('re-sends the snapshot on resume and rejects a wrong match id', async () => {
    const { svc, sent } = harness();
    await svc.start('A', 'B');
    const before = sent.length;
    expect(svc.resume('A')).toEqual({ ok: true });
    // who plays whom (a late joiner never saw `match:found`), then the snapshot
    expect(sent.slice(before).map((e) => e.event)).toEqual(['match:found', 'match:state']);
    expect(svc.resume('A', '0190a000-0000-7000-8000-000000000001')).toEqual({ ok: false, error: 'UNKNOWN_MATCH' });
    expect(svc.resume('Z')).toEqual({ ok: false, error: 'NOT_IN_MATCH' });
  });
});

function memoryUsers(): UserRepository {
  const byId = new Map<string, UserRecord & { deviceId: string }>();
  return {
    async findByDeviceId(d) {
      return [...byId.values()].find((u) => u.deviceId === d) ?? null;
    },
    async findById(id) {
      return byId.get(id) ?? null;
    },
    async createGuest(deviceId, identity) {
      const user = { id: `00000000-0000-7000-8000-${String(byId.size + 1).padStart(12, '0')}`, deviceId, ...identity, isBanned: false };
      byId.set(user.id, user);
      return user;
    },
    async touch() {},
  };
}

describe('live duel over sockets', () => {
  const open: Socket[] = [];
  const apps: ReturnType<typeof buildServer>[] = [];
  afterEach(async () => {
    open.splice(0).forEach((s) => s.close());
    await Promise.all(apps.splice(0).map((a) => a.close()));
  });

  it('pairs two queued players and plays a group to the end', async () => {
    const auth = new AuthService(memoryUsers(), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
    const app = buildServer({ auth, realtime: true, match: { puzzles: source, profile } });
    apps.push(app);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    const dial = async (n: number) => {
      const deviceId = `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}`;
      const { token } = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId } })).json() as { token: string };
      const s = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false });
      open.push(s);
      await new Promise<void>((res) => s.once('connect', () => res()));
      return s;
    };
    const next = <T>(s: Socket, ev: string) => new Promise<T>((res) => s.once(ev, res));

    const a = await dial(1);
    const b = await dial(2);
    const foundA = next(a, 'match:found');
    const foundB = next(b, 'match:found');
    const stateA = next<MatchView>(a, 'match:state');
    expect(await a.emitWithAck('queue:join', { mode: 'duel' })).toEqual({ ok: true });
    expect(await b.emitWithAck('queue:join', { mode: 'duel' })).toEqual({ ok: true });
    expect(matchFoundSchema.parse(await foundA).you).not.toBe(matchFoundSchema.parse(await foundB).you);
    const view = matchViewSchema.parse(await stateA);
    expect(await a.emitWithAck('queue:join', { mode: 'duel' })).toEqual({ ok: false, error: 'ALREADY_IN_MATCH' });

    const mover = view.turn === view.you ? a : b;
    const other = mover === a ? b : a;
    expect(await other.emitWithAck('match:submit', { itemIds: ids(0) })).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
    expect(await mover.emitWithAck('match:submit', { itemIds: ['x'] })).toEqual({ ok: false, error: 'INVALID_PAYLOAD' });
    const seen = next<{ t: string }>(other, 'match:event');
    expect(await mover.emitWithAck('match:submit', { itemIds: ids(0) })).toEqual({ ok: true });
    expect((await seen).t).toBe('guess');

    const ended = next(other, 'match:ended');
    expect(await mover.emitWithAck('match:leave', {})).toEqual({ ok: true });
    expect(matchEndedSchema.parse(await ended).result.reason).toBe('abandon');
    expect(await mover.emitWithAck('match:leave', {})).toEqual({ ok: false, error: 'NOT_IN_MATCH' });
  });
});

describe('no repeated puzzles', () => {
  it('a rematch of the same players is served a different puzzle while others exist', async () => {
    const mk = (n: number) => ({ ...puzzle, id: `pz-${n}` });
    const all = [mk(1), mk(2), mk(3)];
    const history = new PuzzleHistory();
    const svc = new MatchService({
      puzzles: { pickRandom: async (o) => all.find((p) => !(o?.exclude ?? []).includes(p.id)) ?? null, pricesFor: async () => ({}) },
      history,
      profile: async () => ({ nickname: 'n', avatarKey: 'a', level: 1, coins: 0 }),
      emit: () => undefined,
      schedule: () => () => undefined,
    });
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      expect(await svc.start('A', 'B', { friendly: true })).toBe(true);
      seen.push(history.seen(['A']).at(-1)!);
      svc.leave('A');
    }
    expect(new Set(seen).size).toBe(3);
  });
});
