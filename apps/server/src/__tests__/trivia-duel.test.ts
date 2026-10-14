import { describe, expect, it } from 'vitest';
import type { TduelEnded, TduelState, TriviaRoundQuestion } from '@dozari/shared';
import { createMemoryStakeStore } from '../duel/stakes-store.js';
import { TriviaDuelService } from '../realtime/trivia-duel.js';
import { TriviaStakes } from '../trivia/stakes.js';
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

function withCoins(over: Partial<TriviaDuelDeps> = {}) {
  const coins = createMemoryStakeStore();
  for (const u of ['a', 'b', 'poor']) coins.balances.set(u, u === 'poor' ? 5 : 30);
  const stakes = new TriviaStakes(coins, { soloFee: async () => 3, duelFee: async () => 12, houseCutPercent: async () => 10, isBot: (id) => id === 'bot' });
  const leaves: string[] = [];
  const ended: { winner: unknown; reason: string }[] = [];
  const env = setup({ stakes, isBot: (id) => id === 'bot', onLeave: (i) => void leaves.push(i.userId), onEnded: (r) => void ended.push(r), ...over });
  return { ...env, coins, leaves, ended };
}
const bal = (c: ReturnType<typeof createMemoryStakeStore>, ...u: string[]) => u.map((x) => c.balances.get(x));

describe('question duel with coins', () => {
  it('takes the fee at the start, shows it, and pays the winner the pot minus the cut', async () => {
    const { svc, last, coins, ended } = withCoins();
    await svc.join('a');
    await svc.join('b');
    await flush();
    expect(bal(coins, 'a', 'b')).toEqual([18, 18]);
    expect(last<{ fee: number }>('a', 'tduel:found')?.fee).toBe(12);
    for (const right of [0, 1, 2]) {
      svc.answer('a', right);
      svc.answer('b', (right + 1) % 4);
    }
    await flush();
    expect(bal(coins, 'a', 'b')).toEqual([39, 18]);
    expect(last<TduelEnded>('a', 'tduel:ended')).toMatchObject({ coins: 9, canRematch: true });
    expect(last<TduelEnded>('b', 'tduel:ended')?.coins).toBe(-12);
    expect(ended).toEqual([expect.objectContaining({ winner: 0, reason: 'played' })]);
  });

  it('refuses a join without the fee', async () => {
    const { svc } = withCoins();
    expect(await svc.join('poor')).toEqual({ ok: false, error: 'INSUFFICIENT_COINS' });
    expect(svc.isWaiting('poor')).toBe(false);
  });

  it('a player who can no longer pay when the pairing happens is refused, and the other keeps waiting', async () => {
    const coins = createMemoryStakeStore();
    coins.balances.set('a', 30);
    coins.balances.set('poor', 5);
    const real = new TriviaStakes(coins, { soloFee: async () => 3, duelFee: async () => 12, houseCutPercent: async () => 10, isBot: () => false });
    // The balance check at the join passes (they had the coins then); the fee is taken a moment later.
    const stakes = Object.assign(Object.create(real), { canAffordDuel: async () => true }) as TriviaStakes;
    const { svc, last } = setup({ stakes });
    await svc.join('a');
    await svc.join('poor');
    await flush();
    expect(last('poor', 'tduel:refused')).toEqual({ error: 'INSUFFICIENT_COINS' });
    expect(svc.isWaiting('poor')).toBe(false);
    expect(svc.isWaiting('a')).toBe(true);
    expect(coins.balances.get('a')).toBe(30); // nothing was kept
  });

  it('a leaver forfeits the fee, is logged for the leave penalty, and the rival is paid', async () => {
    const { svc, last, coins, leaves } = withCoins();
    await svc.join('a');
    await svc.join('b');
    await flush();
    expect(svc.leave('a')).toEqual({ ok: true });
    await flush();
    expect(leaves).toEqual(['a']);
    expect(last<TduelEnded>('b', 'tduel:ended')).toMatchObject({ winner: 1, reason: 'forfeit', coins: 9, canRematch: false });
    expect(last<TduelEnded>('a', 'tduel:ended')?.coins).toBe(-12);
    expect(bal(coins, 'a', 'b')).toEqual([18, 39]);
  });

  it('a bot opponent: the human pays only their own fee, and a leave of the human is logged but a bot never is', async () => {
    const { svc, coins, leaves } = withCoins();
    await svc.join('a');
    expect(await svc.startWithBot('a', 'bot')).toBe(true);
    expect(bal(coins, 'a')).toEqual([18]);
    svc.leave('bot');
    await flush();
    expect(leaves).toEqual([]);
    expect(bal(coins, 'a')).toEqual([39]); // the bot left: the human wins the pot
  });

  it('a human who cannot pay when a bot is given leaves the line with a refusal', async () => {
    const { svc, last, coins } = withCoins();
    await svc.join('a');
    coins.balances.set('a', 3);
    expect(await svc.startWithBot('a', 'bot')).toBe(false);
    expect(last('a', 'tduel:refused')).toEqual({ error: 'INSUFFICIENT_COINS' });
    expect(svc.isWaiting('a')).toBe(false);
  });
});

describe('question duel rematch', () => {
  const play = (svc: TriviaDuelService) => {
    for (const right of [0, 1, 2]) {
      svc.answer('a', right);
      svc.answer('b', right);
    }
  };

  it('needs both sides: the first ask only tells the rival, the second starts the same game again and charges again', async () => {
    const { svc, last, coins, events } = withCoins();
    await svc.join('a', T1);
    await svc.join('b');
    await flush();
    play(svc);
    await flush();
    expect(last<TduelEnded>('a', 'tduel:ended')?.canRematch).toBe(true);
    expect(await svc.rematch('a')).toEqual({ ok: true });
    expect(last('b', 'tduel:offer')).toEqual({ state: 'asked' });
    expect(svc.inMatch('a')).toBe(false);
    const before = events.filter((e) => e.event === 'tduel:found').length;
    expect(await svc.rematch('b')).toEqual({ ok: true });
    await flush();
    expect(svc.inMatch('a') && svc.inMatch('b')).toBe(true);
    expect(events.filter((e) => e.event === 'tduel:found').length).toBe(before + 2);
    expect(last<{ topicNameFa: string }>('a', 'tduel:found')?.topicNameFa).toBe('تاریخ');
    expect(bal(coins, 'a', 'b')).toEqual([16, 16]); // 30 − 12, +10 back from the drawn game, − 12 for the rematch
  });

  it('a bot rival accepts at once', async () => {
    const { svc } = withCoins();
    await svc.join('a');
    await svc.startWithBot('a', 'bot');
    for (const right of [0, 1, 2]) {
      svc.answer('a', right);
      svc.answer('bot', right);
    }
    await flush();
    expect(await svc.rematch('a')).toEqual({ ok: true });
    await flush();
    expect(svc.inMatch('a') && svc.inMatch('bot')).toBe(true);
  });

  it('is gone after a forfeit, after the window, and once the player starts something else', async () => {
    const { svc, last, timers } = withCoins();
    await svc.join('a');
    await svc.join('b');
    await flush();
    svc.leave('a');
    await flush();
    expect(await svc.rematch('b')).toEqual({ ok: false, error: 'UNKNOWN_MATCH' });

    await svc.join('a');
    await svc.join('b');
    await flush();
    play(svc);
    await flush();
    timers.filter((t) => t.live).at(-1)!.fn(); // the rematch window closes
    expect(last('a', 'tduel:offer')).toEqual({ state: 'expired' });
    expect(await svc.rematch('a')).toEqual({ ok: false, error: 'UNKNOWN_MATCH' });
  });

  it('asking while unable to pay is refused, and joining the search cancels the old offer for the rival', async () => {
    const { svc, last, coins } = withCoins();
    await svc.join('a');
    await svc.join('b');
    await flush();
    play(svc);
    await flush();
    await svc.rematch('a');
    await svc.join('b', 'none-topic-free'); // b searches instead
    expect(last('a', 'tduel:offer')).toEqual({ state: 'expired' });
    coins.balances.set('a', 0);
    expect(await svc.rematch('a')).toEqual({ ok: false, error: 'UNKNOWN_MATCH' });
  });
});
