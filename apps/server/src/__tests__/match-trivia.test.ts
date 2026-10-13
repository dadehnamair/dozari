import { describe, expect, it } from 'vitest';
import { matchEndedSchema, matchViewSchema } from '@dozari/shared';
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
const bank = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `q${i}`, textFa: `سؤال ${i}`, options: ['الف', 'ب', 'ج', 'د'], correctIndex: i % 4, explanationFa: `شرح ${i}` }));

function harness(opts: { rounds: number; questions?: number }) {
  let t = 1_000_000;
  const timers: { at: number; fn: () => void; live: boolean }[] = [];
  const sent: { to: string; event: string; payload: unknown }[] = [];
  const svc = new MatchService({
    puzzles: source,
    profile,
    emit: (to, event, payload) => sent.push({ to, event, payload }),
    triviaRounds: async () => opts.rounds,
    triviaQuestions: async ({ count }) => bank(opts.questions ?? 10).slice(0, count),
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
  const playPuzzle = async () => {
    await svc.start('A', 'B');
    const v = matchViewSchema.parse(last('A', 'match:state'));
    const first = v.turn === 0 ? 'A' : 'B';
    for (const level of [0, 1, 2]) svc.submit(first, ids(level));
    await new Promise((r) => setTimeout(r, 0));
    return first;
  };
  return { svc, sent, advance, last, playPuzzle };
}

describe('duel general-question round', () => {
  it('without the setting the match ends with the puzzle', async () => {
    const { svc, last, playPuzzle } = harness({ rounds: 0 });
    await playPuzzle();
    expect(matchEndedSchema.parse(last('A', 'match:ended')).triviaRound).toBeUndefined();
    expect(svc.activeCount).toBe(0);
  });

  it('keeps the match open, never sends the right choice early, and the right answers decide a tied board', async () => {
    const { svc, sent, last, playPuzzle } = harness({ rounds: 3 });
    const first = await playPuzzle();
    const other = first === 'A' ? 'B' : 'A';
    const during = matchViewSchema.parse(last('A', 'match:state'));
    expect(during.status).toBe('playing');
    expect(during.triviaRound?.current?.options).toHaveLength(4);
    expect(last('A', 'match:ended')).toBeUndefined();
    expect(JSON.stringify(sent)).not.toContain('correctIndex');
    // Question i's right choice is i % 4: the other side answers all right, the puzzle winner all wrong.
    for (let i = 0; i < 3; i++) {
      expect(svc.submitTrivia(first, (i + 1) % 4)).toEqual({ ok: true });
      expect(svc.submitTrivia(other, i % 4)).toEqual({ ok: true });
    }
    const ended = matchEndedSchema.parse(last(first, 'match:ended'));
    expect(ended.triviaRound?.revealed).toHaveLength(3);
    expect(ended.triviaRound?.revealed[0]).toMatchObject({ correctIndex: 0, yourPick: 1, opponentPick: 0 });
    expect(svc.activeCount).toBe(0);
  });

  it('a second answer is ignored, a timeout reveals the question, and no round while none runs', async () => {
    const { svc, advance, last, playPuzzle } = harness({ rounds: 2 });
    const first = await playPuzzle();
    expect(svc.submitTrivia(first, 0)).toEqual({ ok: true });
    expect(svc.submitTrivia(first, 1)).toEqual({ ok: true });
    advance(60_000);
    const v = matchViewSchema.parse(last(first, 'match:state'));
    expect(v.triviaRound?.roundIndex).toBe(1);
    expect(v.triviaRound?.revealed[0]?.yourPick).toBe(0);
    expect(v.triviaRound?.revealed[0]?.opponentPick).toBeNull();
    advance(60_000);
    expect(svc.activeCount).toBe(0);
    expect(svc.submitTrivia(first, 0)).toMatchObject({ ok: false });
  });

  it('with an empty question bank the match just ends', async () => {
    const { svc, last, playPuzzle } = harness({ rounds: 3, questions: 0 });
    await playPuzzle();
    expect(matchEndedSchema.parse(last('A', 'match:ended')).triviaRound).toBeUndefined();
    expect(svc.activeCount).toBe(0);
  });
});
