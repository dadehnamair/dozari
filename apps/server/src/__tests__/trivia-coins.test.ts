import { describe, expect, it } from 'vitest';
import { createMemoryStakeStore } from '../duel/stakes-store.js';
import { TriviaService } from '../trivia/service.js';
import { TriviaStakes } from '../trivia/stakes.js';
import { createMemoryTriviaStore } from '../trivia/store.js';

const FOOD = '00000000-0000-7000-d000-000000000001';

async function setup(fees = { solo: 3, duel: 12 }) {
  const store = createMemoryTriviaStore({ [FOOD]: 'خوراکی' });
  for (let i = 0; i < 4; i++) await store.create({ topicId: FOOD, textFa: `پرسش شماره ${i}؟`, options: [`الف${i}`, `ب${i}`, `ج${i}`, `د${i}`], correctIndex: 1, explanationFa: '', ageTrack: 'adult' }, 'approved');
  const coins = createMemoryStakeStore();
  for (const u of ['p', 'q', 'probe']) coins.balances.set(u, 20);
  const stakes = new TriviaStakes(coins, { soloFee: async () => fees.solo, duelFee: async () => fees.duel, houseCutPercent: async () => 10, isBot: (id) => id === 'bot' });
  const finished: { passed: boolean }[] = [];
  const svc = new TriviaService(store, { newSeed: () => 3, perGame: async () => 4, stakes, refundPercent: async () => 75, onFinished: (_u, _s, _t, passed) => finished.push({ passed }) });
  /** The seed is fixed, so a probe game shows which choice is right in every question of the next one. */
  const rightIndexes = async () => {
    const view = await svc.start({ userId: 'probe', tracks: ['adult'] });
    if (!view || view === 'insufficient_coins') throw new Error('no game');
    const out: number[] = [];
    for (const r of view.rounds) {
      const a = await svc.answer(view.sessionId, r.index, 0);
      if (!a || a === 'unknown_question') throw new Error('bad answer');
      out.push(a.result.correctIndex);
    }
    return out;
  };
  return { svc, stakes, coins, finished, rightIndexes };
}

async function play(svc: TriviaService, userId: string, picks: number[]) {
  const view = await svc.start({ userId, tracks: ['adult'] });
  if (!view || view === 'insufficient_coins') throw new Error('no game');
  let last = view;
  for (const r of view.rounds) {
    const a = await svc.answer(view.sessionId, r.index, picks[r.index]!);
    if (!a || a === 'unknown_question') throw new Error('bad answer');
    last = a.view;
  }
  return { first: view, last };
}

describe('solo trivia coins', () => {
  it('charges the fee at the start and gives it back for a good score', async () => {
    const { svc, coins, finished, rightIndexes } = await setup();
    const right = await rightIndexes();
    const { first, last } = await play(svc, 'p', right);
    expect(first.fee).toBe(3);
    expect(last).toMatchObject({ done: true, score: 4, refund: 3 });
    expect(coins.balances.get('p')).toBe(20); // paid 3, got 3 back
    expect(finished.at(-1)).toEqual({ passed: true });
  });

  it('keeps the fee on a poor score, and a repeated answer neither refunds nor finishes twice', async () => {
    const { svc, coins, finished, rightIndexes } = await setup();
    const right = await rightIndexes();
    const wrong = right.map((r) => (r + 1) % 4);
    const before = finished.length;
    const { first, last } = await play(svc, 'p', wrong);
    expect(last).toMatchObject({ done: true, score: 0, refund: 0 });
    expect(coins.balances.get('p')).toBe(17);
    await svc.answer(first.sessionId, 3, right[3]!); // already answered: the first answer stands
    expect(finished.length).toBe(before + 1);
    expect(finished.at(-1)).toEqual({ passed: false });
    expect(coins.balances.get('p')).toBe(17);
  });

  it('refuses a player who cannot pay and never charges an anonymous game', async () => {
    const { svc, coins } = await setup();
    coins.balances.set('p', 2);
    expect(await svc.start({ userId: 'p', tracks: ['adult'] })).toBe('insufficient_coins');
    expect(coins.balances.get('p')).toBe(2);
    const anon = await svc.start({ tracks: ['adult'] });
    expect(anon && anon !== 'insufficient_coins' && anon.fee).toBe(0);
  });

  it('a free solo game (fee 0) charges nothing', async () => {
    const { svc, coins } = await setup({ solo: 0, duel: 12 });
    const view = await svc.start({ userId: 'p', tracks: ['adult'] });
    expect(view && view !== 'insufficient_coins' && view.fee).toBe(0);
    expect(coins.balances.get('p')).toBe(20);
  });
});

describe('question duel coins', () => {
  it('both pay the fee; the winner gets the pot minus the cut; settling twice changes nothing', async () => {
    const { stakes, coins } = await setup();
    const opened = await stakes.openDuel('m1', ['p', 'q']);
    expect(opened).toMatchObject({ ok: true, stakes: ['paid', 'paid'], fee: 12 });
    expect([coins.balances.get('p'), coins.balances.get('q')]).toEqual([8, 8]);
    const net = await stakes.settleDuel('m1', ['p', 'q'], ['paid', 'paid'], 12, { winner: 0, reason: 'solved' });
    expect(net).toEqual([9, -12]);
    await stakes.settleDuel('m1', ['p', 'q'], ['paid', 'paid'], 12, { winner: 0, reason: 'solved' });
    expect([coins.balances.get('p'), coins.balances.get('q')]).toEqual([29, 8]);
  });

  it('a player who cannot pay stops the game and the other gets their fee back', async () => {
    const { stakes, coins } = await setup();
    coins.balances.set('q', 5);
    expect(await stakes.openDuel('m2', ['p', 'q'])).toEqual({ ok: false, broke: 'q' });
    expect(coins.balances.get('p')).toBe(20);
  });

  it('a bot seat is covered by the house', async () => {
    const { stakes, coins } = await setup();
    const opened = await stakes.openDuel('m3', ['p', 'bot']);
    expect(opened).toMatchObject({ ok: true, stakes: ['paid', 'house'] });
    expect(coins.balances.get('p')).toBe(8);
    expect(await stakes.settleDuel('m3', ['p', 'bot'], ['paid', 'house'], 12, { winner: 0, reason: 'solved' })).toEqual([9, 0]);
    expect(coins.balances.get('p')).toBe(29);
  });

  it('a forfeit pays the rival and the leaver gets nothing back', async () => {
    const { stakes, coins } = await setup();
    await stakes.openDuel('m4', ['p', 'q']);
    await stakes.settleDuel('m4', ['p', 'q'], ['paid', 'paid'], 12, { winner: 1, reason: 'forfeit' });
    expect([coins.balances.get('p'), coins.balances.get('q')]).toEqual([8, 29]);
  });
});
