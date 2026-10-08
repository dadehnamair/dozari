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

  it('a spectator sees the board and the players but no proposal, no solution and no private ids', async () => {
    const { svc } = harness();
    await svc.startTeam([['a1', 'a2'], ['b1', 'b2']]);
    const mate = svc.spectate('a1')!;
    expect(svc.spectate('nobody')).toBeNull();
    const seat0Cap = mate.view.captain![0] === 'a1' ? 'a2' : 'a1';
    svc.propose(seat0Cap, ['g0p0', 'g0p1']);
    const seen = svc.spectate('b2')!;
    expect(matchViewSchema.safeParse(seen.view).success).toBe(true);
    expect(seen.view.proposal).toBeNull();
    expect(seen.view.youId).toBeUndefined();
    expect(seen.view.priceRound ?? null).toBeNull();
    expect(seen.players).toHaveLength(4);
    expect(seen.names['g0p0']).toBe('کالا 0-0');
    expect(seen.view.cards).toHaveLength(16);
    expect(JSON.stringify(seen)).not.toContain('عنوان'); // unsolved group titles stay hidden
  });

  it('the stands see the latest guesses with their names and result, and the lobby gets the score', async () => {
    const { svc, view } = harness();
    await svc.startTeam([['a1', 'a2'], ['b1', 'b2']]);
    expect(svc.spectate('a1')!.recent).toEqual([]);
    const cap = view('a1').captain![view('a1').turn]!;
    expect(svc.submit(cap, ids(0))).toEqual({ ok: true }); // a real group
    const seen = svc.spectate('b1')!;
    expect(seen.recent).toHaveLength(1);
    expect(seen.recent[0]).toMatchObject({ outcome: 'correct', names: ['کالا 0-0', 'کالا 0-1', 'کالا 0-2', 'کالا 0-3'] });
    const scores = svc.scoresOf('b2')!;
    expect(scores[0] + scores[1]).toBeGreaterThan(0);
    expect(svc.scoresOf('nobody')).toBeNull();
  });

  it('tells the team hook who played on which side when a 2v2 ends', async () => {
    const seen: { players: { userId: string; side: number }[]; winner: number | null }[] = [];
    const svc = new MatchService({ puzzles: source, profile, emit: () => undefined, now: () => 1_000_000, newSeed: () => 5, schedule: () => () => undefined, onTeamEnded: ({ players, result }) => seen.push({ players: [...players], winner: result.winner }) });
    await svc.startTeam([['a1', 'a2'], ['b1', 'b2']]);
    svc.leave('a1');
    svc.leave('a2');
    expect(seen).toHaveLength(1);
    expect(seen[0]!.players.map((p) => `${p.userId}:${p.side}`).sort()).toEqual(['a1:0', 'a2:0', 'b1:1', 'b2:1']);
    expect(seen[0]!.winner).toBe(1);
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
