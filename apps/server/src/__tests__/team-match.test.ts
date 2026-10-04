import { describe, expect, it } from 'vitest';
import { matchViewSchema } from '@dozari/shared';
import { MatchService } from '../realtime/match-service.js';
import type { PlayerProfile } from '../realtime/match-service.js';
import { DuelQueue } from '../realtime/queue.js';
import type { PuzzleSource, ServedPuzzle } from '../solo/types.js';

const puzzle: ServedPuzzle = {
  id: 'pz1',
  groups: ([0, 1, 2, 3] as const).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`), titleFa: `عنوان ${level}`, explanationFa: `توضیح ${level}` })),
  items: Object.fromEntries([0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].map((i) => [`g${l}p${i}`, { nameFa: `کالا ${l}-${i}`, unitFa: null }]))),
};
const ids = (level: number) => [0, 1, 2, 3].map((i) => `g${level}p${i}`);
const source: PuzzleSource = { pickRandom: async () => puzzle, pricesFor: async () => ({}) };
const profile = async (userId: string): Promise<PlayerProfile> => ({ nickname: `n-${userId}`, avatarKey: 'a', level: 1, coins: 0 });

function harness() {
  const sent: { to: string; event: string; payload: unknown }[] = [];
  const svc = new MatchService({ puzzles: source, profile, emit: (to, event, payload) => sent.push({ to, event, payload }), now: () => 1_000_000, newSeed: () => 5, schedule: () => () => undefined });
  const view = (to: string) => matchViewSchema.parse(sent.filter((s) => s.to === to && s.event === 'match:state').at(-1)?.payload);
  return { svc, sent, view };
}

describe('2v2 MatchService', () => {
  it('seats four, sends every one a view, and never leaks a proposal to the other team', async () => {
    const { svc, sent, view } = harness();
    expect(await svc.startTeam([['a1', 'a2'], ['b1', 'b2']])).toBe(true);
    expect(svc.activeCount).toBe(1);
    const v = view('a1');
    expect(v.youId).toBe('a1');
    const side = v.turn;
    const [cap, mate, rival] = side === 0 ? ['a1', 'a2', 'b1'] : ['b1', 'b2', 'a1'];
    expect(svc.submit(mate!, ids(0))).toEqual({ ok: false, error: 'NOT_CAPTAIN' });
    expect(svc.propose(mate!, ['g0p0', 'g0p1'])).toEqual({ ok: true });
    expect(view(cap!).proposal).toEqual({ by: mate, itemIds: ['g0p0', 'g0p1'] });
    expect(view(mate!).proposal?.itemIds).toHaveLength(2);
    expect(view(rival!).proposal ?? null).toBeNull();
    expect(sent.some((s) => s.event === 'match:event' && JSON.stringify(s.payload).includes('proposal'))).toBe(false);
    expect(JSON.stringify(sent)).not.toContain('عنوان');
    expect(svc.submit(cap!, ids(0))).toEqual({ ok: true });
  });

  it('rejects a duel proposal, a stranger, and a double start', async () => {
    const { svc } = harness();
    await svc.start('x', 'y');
    expect(svc.propose('x', [])).toEqual({ ok: false, error: 'NOT_TEAM_MATCH' });
    expect(svc.propose('z', [])).toEqual({ ok: false, error: 'NOT_IN_MATCH' });
    expect(await svc.startTeam([['x', 'a2'], ['b1', 'b2']])).toBe(false);
    expect(await svc.startTeam([['a1', 'a1'], ['b1', 'b2']])).toBe(false);
  });

  it('a leaver is freed while the team plays on; the last one out ends it', async () => {
    const { svc } = harness();
    await svc.startTeam([['a1', 'a2'], ['b1', 'b2']]);
    expect(svc.leave('a1')).toEqual({ ok: true });
    expect(svc.inMatch('a1')).toBe(false);
    expect(svc.activeCount).toBe(1);
    expect(svc.leave('a2')).toEqual({ ok: true });
    expect(svc.activeCount).toBe(0);
    expect(svc.inMatch('b1')).toBe(false);
  });
});

describe('DuelQueue.takeGroup', () => {
  it('takes the longest waiters, or nothing when short', () => {
    const q = new DuelQueue();
    for (const [i, u] of ['a', 'b', 'c'].entries()) q.join(u, i);
    expect(q.takeGroup(4)).toBeNull();
    q.join('d', 3);
    q.join('e', 4);
    expect(q.takeGroup(4)).toEqual(['a', 'b', 'c', 'd']);
    expect(q.length).toBe(1);
  });
});

describe('2v2 over several boards', () => {
  const mk = (tag: string): ServedPuzzle => ({
    id: `pz-${tag}`,
    groups: ([0, 1, 2, 3] as const).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `${tag}g${level}p${i}`), titleFa: `عنوان ${tag}${level}`, explanationFa: `توضیح ${tag}${level}` })),
    items: Object.fromEntries([0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].map((i) => [`${tag}g${l}p${i}`, { nameFa: `کالا ${tag}${l}-${i}`, unitFa: null }]))),
  });
  const pool = [mk('a'), mk('b'), mk('c')];
  const boards = (tag: string, level: number) => [0, 1, 2, 3].map((i) => `${tag}g${level}p${i}`);

  it('plays the configured number of different boards, reveals a finished board and hides the next', async () => {
    const sent: { to: string; event: string; payload: unknown }[] = [];
    let n = 0;
    const svc = new MatchService({
      puzzles: { pickRandom: async () => pool[n++ % 3]!, pricesFor: async () => ({}) },
      profile,
      emit: (to, event, payload) => sent.push({ to, event, payload }),
      teamBoards: async () => 3,
      now: () => 1_000_000,
      newSeed: () => 5,
      schedule: () => () => undefined,
    });
    expect(await svc.startTeam([['a1', 'a2'], ['b1', 'b2']])).toBe(true);
    const view = (to: string) => matchViewSchema.parse(sent.filter((s) => s.to === to && s.event === 'match:state').at(-1)?.payload);
    expect([view('a1').round, view('a1').rounds]).toEqual([0, 3]);
    expect(JSON.stringify(sent)).not.toContain('عنوان');
    const playBoard = (tag: string) => {
      for (let level = 0; level < 3; level++) {
        const v = view('a1');
        const cap = v.captain![v.turn]!;
        expect(svc.submit(cap, boards(tag, level))).toEqual({ ok: true });
      }
    };
    playBoard('a');
    expect(view('a1').round).toBe(1);
    expect(view('a1').cards.every((c) => c.id.startsWith('b'))).toBe(true);
    const done = sent.filter((s) => s.to === 'a1' && s.event === 'match:event').map((s) => s.payload as { t: string; round?: number; groups?: unknown[] }).find((e) => e.t === 'board_done');
    expect(done).toMatchObject({ round: 0 });
    expect(done?.groups).toHaveLength(4);
    expect(JSON.stringify(sent.filter((s) => s.event === 'match:state'))).not.toContain('عنوان c');
    playBoard('b');
    expect(view('a1').round).toBe(2);
    playBoard('c');
    expect(view('a1').status).toBe('finished');
    expect(svc.activeCount).toBe(0);
    const ended = sent.filter((s) => s.event === 'match:ended').at(-1)?.payload as { scores: number[]; groups: { titleFa: string }[] };
    expect(ended.groups[0]!.titleFa).toContain('c'); // the last board's solution
    expect(ended.scores[0]! + ended.scores[1]!).toBeGreaterThan(0);
  });
});
