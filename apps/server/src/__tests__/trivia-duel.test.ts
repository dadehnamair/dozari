import { describe, expect, it } from 'vitest';
import type { TduelEnded, TduelState, TriviaRoundQuestion } from '@dozari/shared';
import { TriviaDuelService } from '../realtime/trivia-duel.js';
import type { TriviaDuelDeps } from '../realtime/trivia-duel.js';

const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '22222222-2222-4222-8222-222222222222';
const q = (id: string, correctIndex: number): TriviaRoundQuestion => ({ id, textFa: `سؤال ${id}`, options: ['الف', 'ب', 'ج', 'د'], correctIndex, explanationFa: '' });

function setup(over: Partial<TriviaDuelDeps> = {}, questions: TriviaRoundQuestion[] = [q('1', 0), q('2', 1), q('3', 2)]) {
  const events: { to: string; event: string; payload: unknown }[] = [];
  const timers: { ms: number; fn: () => void; live: boolean }[] = [];
  const svc = new TriviaDuelService({
    emit: (to, event, payload) => void events.push({ to, event, payload }),
    profile: async (id) => ({ nickname: id, avatarKey: 'a', level: 1, coins: 0 }),
    questions: async ({ topicId, count }) => (topicId === 'none' ? [] : questions.slice(0, count)),
    topicName: async (id) => (id === T1 ? 'تاریخ' : null),
    settings: async () => ({ questions: 3, seconds: 10 }),
    introMs: 0,
    schedule: (ms, fn) => {
      const t = { ms, fn, live: true };
      timers.push(t);
      return () => void (t.live = false);
    },
    ...over,
  });
  const last = <T>(to: string, event: string) => [...events].reverse().find((e) => e.to === to && e.event === event)?.payload as T | undefined;
  const fire = () => timers.filter((t) => t.live).at(-1)!.fn();
  return { svc, events, last, fire, timers };
}
const flush = () => new Promise((r) => setImmediate(r));

describe('question duel', () => {
  it('pairs a topic player with a random one, plays blind and ends with a winner', async () => {
    const { svc, last, events } = setup();
    expect(await svc.join('a', T1)).toEqual({ ok: true });
    expect(svc.isWaiting('a')).toBe(true);
    expect(await svc.join('b')).toEqual({ ok: true });
    await flush();
    expect(svc.inMatch('a') && svc.inMatch('b')).toBe(true);
    expect(events.filter((e) => e.event === 'tduel:found')).toHaveLength(2);
    expect(last<{ topicNameFa: string }>('a', 'tduel:found')?.topicNameFa).toBe('تاریخ');
    // a answers right, b wrong, on each question
    for (const right of [0, 1, 2]) {
      expect(svc.answer('a', right)).toEqual({ ok: true });
      const mid = last<TduelState>('b', 'tduel:state')!;
      expect(mid.round.opponentAnswered).toBe(true); // a fact, not the choice
      expect(mid.round.revealed.length).toBe(right); // nothing about the open question is revealed
      expect(Object.keys(mid.round.current ?? {}).sort()).toEqual(['options', 'textFa']);
      svc.answer('b', (right + 1) % 4);
    }
    const ended = last<TduelEnded>('a', 'tduel:ended')!;
    expect(ended).toMatchObject({ winner: 0, reason: 'played', scores: [3, 0] });
    expect(svc.inMatch('a')).toBe(false);
    expect(last<TduelEnded>('b', 'tduel:ended')?.round.revealed[0]?.yourPick).toBe(1);
  });

  it('keeps different topics apart and pairs two randoms', async () => {
    const { svc } = setup();
    await svc.join('a', T1);
    await svc.join('b', T2);
    await flush();
    expect(svc.inMatch('a') || svc.inMatch('b')).toBe(false);
    await svc.join('c');
    await flush();
    expect(svc.inMatch('a') && svc.inMatch('c')).toBe(true); // random takes the longest waiter
    expect(svc.isWaiting('b')).toBe(true);
  });

  it('refuses a topic with no questions and a double join', async () => {
    const { svc } = setup();
    expect(await svc.join('a', 'none')).toEqual({ ok: false, error: 'NO_QUESTIONS' });
    await svc.join('a');
    expect(await svc.join('a')).toEqual({ ok: false, error: 'ALREADY_QUEUED' });
  });

  it('honours the gate and the board-duel busy check', async () => {
    const { svc } = setup({ gate: async (id) => (id === 'kid' ? 'FEATURE_OFF' : null), busy: (id) => id === 'busy' });
    expect(await svc.join('kid')).toEqual({ ok: false, error: 'FEATURE_OFF' });
    expect(await svc.join('busy')).toEqual({ ok: false, error: 'ALREADY_IN_MATCH' });
  });

  it('a timeout reveals the question with no answer counted wrong; a draw has no winner', async () => {
    const { svc, last, fire } = setup(undefined, [q('1', 0)]);
    await svc.join('a');
    await svc.join('b');
    await flush();
    fire();
    expect(last<TduelEnded>('a', 'tduel:ended')).toMatchObject({ winner: null, scores: [0, 0] });
  });

  it('gives a waiting human a bot and lets the bot read the right answer only server-side', async () => {
    const { svc, last } = setup();
    await svc.join('a', T1);
    expect(await svc.startWithBot('a', 'bot')).toBe(true);
    expect(svc.inMatch('bot')).toBe(true);
    expect(svc.answerFor('bot')).toBe(0);
    svc.answer('bot', 0);
    expect(svc.answerFor('bot')).toBeNull(); // already answered this question
    expect(Object.keys(last<TduelState>('a', 'tduel:state')!.round.current ?? {}).sort()).toEqual(['options', 'textFa']);
  });

  it('leaving a running game forfeits it to the rival; resume re-sends the snapshot', async () => {
    const { svc, last, events } = setup();
    await svc.join('a');
    await svc.join('b');
    await flush();
    const before = events.length;
    expect(svc.resume('a')).toBe(true);
    expect(events.length).toBe(before + 2);
    expect(svc.leave('a')).toEqual({ ok: true });
    expect(last<TduelEnded>('b', 'tduel:ended')).toMatchObject({ winner: 1, reason: 'forfeit' });
    expect(svc.resume('a')).toBe(false);
    expect(svc.leave('a')).toEqual({ ok: false, error: 'NOT_IN_MATCH' });
  });

  it('holds the first question back during the versus card', async () => {
    const { svc, events, timers } = setup({ introMs: 3000 });
    await svc.join('a');
    await svc.join('b');
    await flush();
    expect(events.filter((e) => e.event === 'tduel:found')).toHaveLength(2);
    expect(events.some((e) => e.event === 'tduel:state')).toBe(false);
    expect(svc.answer('a', 0)).toEqual({ ok: false, error: 'NO_TRIVIA_ROUND' });
    expect(svc.answerFor('a')).toBeNull();
    timers[0]!.fn();
    expect(events.filter((e) => e.event === 'tduel:state')).toHaveLength(2);
    expect(svc.answer('a', 0)).toEqual({ ok: true });
  });

  it('leaving the line removes the player', async () => {
    const { svc } = setup();
    await svc.join('a');
    expect(svc.leave('a')).toEqual({ ok: true });
    expect(svc.isWaiting('a')).toBe(false);
  });
});
