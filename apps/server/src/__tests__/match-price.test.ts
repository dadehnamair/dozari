import { describe, expect, it } from 'vitest';
import { TURN_SECONDS, matchEndedSchema, matchViewSchema } from '@dozari/shared';
import { MatchService } from '../realtime/match-service.js';
import type { PlayerProfile } from '../realtime/match-service.js';
import type { PuzzleSource, ServedPuzzle } from '../solo/types.js';

const puzzle: ServedPuzzle = {
  id: 'pz1',
  groups: ([0, 1, 2, 3] as const).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`), titleFa: `عنوان ${level}`, explanationFa: `توضیح ${level}` })),
  items: Object.fromEntries([0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].map((i) => [`g${l}p${i}`, { nameFa: `کالا ${l}-${i}`, unitFa: null }]))),
};
const ids = (level: number) => [0, 1, 2, 3].map((i) => `g${level}p${i}`);
const SECRET = 7_654_321n;
const source: PuzzleSource = {
  pickRandom: async () => puzzle,
  pricesFor: async (productIds) => Object.fromEntries(productIds.map((id) => [id, [{ year: 1390, month: null, priceRials: SECRET }]])),
};
const profile = async (userId: string): Promise<PlayerProfile> => ({ nickname: `n-${userId}`, avatarKey: 'a', level: 1, coins: 0 });

function harness(opts: { priceRound: boolean; prices?: boolean }) {
  let t = 1_000_000;
  const timers: { at: number; fn: () => void; live: boolean }[] = [];
  const sent: { to: string; event: string; payload: unknown }[] = [];
  const svc = new MatchService({
    puzzles: opts.prices === false ? { ...source, pricesFor: async () => ({}) } : source,
    profile,
    emit: (to, event, payload) => sent.push({ to, event, payload }),
    priceRound: async () => opts.priceRound,
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
  /** Whoever has the turn solves three groups, which ends the board. */
  const playPuzzle = async () => {
    await svc.start('A', 'B');
    const v = matchViewSchema.parse(last('A', 'match:state'));
    const first = v.turn === 0 ? 'A' : 'B';
    for (const level of [0, 1, 2]) svc.submit(first, ids(level));
    await new Promise((r) => setTimeout(r, 0)); // the rounds are drawn asynchronously
    return first;
  };
  return { svc, sent, advance, last, playPuzzle };
}

describe('duel price-guess round', () => {
  it('without the setting the match ends with the puzzle, as before', async () => {
    const { svc, last, playPuzzle } = harness({ priceRound: false });
    await playPuzzle();
    expect(matchEndedSchema.parse(last('A', 'match:ended')).result.reason).toBe('solved');
    expect(svc.activeCount).toBe(0);
  });

  it('keeps the match open after the puzzle, shows the question without the price, then ends with the puzzle winner', async () => {
    const { svc, sent, last, playPuzzle } = harness({ priceRound: true });
    const first = await playPuzzle();
    const other = first === 'A' ? 'B' : 'A';
    const during = matchViewSchema.parse(last('A', 'match:state'));
    expect(during.status).toBe('playing');
    expect(during.result).toBeNull();
    expect(during.priceRound?.current).not.toBeNull();
    expect(last('A', 'match:ended')).toBeUndefined();
    expect(sent.some((s) => s.event === 'match:event' && JSON.stringify(s.payload).includes('"finished"'))).toBe(false);
    expect(JSON.stringify(sent)).not.toContain(SECRET.toString());

    for (let round = 0; round < 4; round++) {
      expect(svc.submitPrice(first, 8_000_000n)).toEqual({ ok: true });
      if (round === 0) expect(JSON.stringify(sent)).not.toContain('8000000'); // a hidden guess stays hidden until both are in
      expect(svc.submitPrice(other, 5_000_000n)).toEqual({ ok: true });
    }
    const ended = matchEndedSchema.parse(last(first, 'match:ended'));
    expect(ended.result).toEqual({ winner: first === 'A' ? 0 : 1, reason: 'solved' });
    expect(ended.priceRound?.revealed).toHaveLength(4);
    expect(ended.priceRound?.revealed[0]).toMatchObject({ actualRials: SECRET.toString(), yourGuess: '8000000', opponentGuess: '5000000' });
    expect(ended.priceRound?.revealed.every((r) => r.winner === 'you')).toBe(true); // 8.0M is closer to 7.65M than 5.0M
    expect(svc.activeCount).toBe(0);
    expect(svc.inMatch('A')).toBe(false);
  });

  it('reveals a round on the clock: a side that never guessed loses it, and four silent rounds end the match', async () => {
    const { svc, advance, last, playPuzzle } = harness({ priceRound: true });
    const first = await playPuzzle();
    svc.submitPrice(first, 7_000_000n);
    for (let i = 0; i < 4; i++) advance(TURN_SECONDS * 1000 + 1);
    const ended = matchEndedSchema.parse(last(first, 'match:ended'));
    expect(ended.priceRound?.revealed).toHaveLength(4);
    expect(ended.priceRound?.revealed[0]).toMatchObject({ yourGuess: '7000000', opponentGuess: null, winner: 'you' });
    expect(svc.activeCount).toBe(0);
  });

  it('ignores a second guess in the same round and refuses guesses outside the round', async () => {
    const { svc, playPuzzle } = harness({ priceRound: true });
    expect(svc.submitPrice('A', 1n)).toEqual({ ok: false, error: 'NOT_IN_MATCH' });
    const first = await playPuzzle();
    expect(svc.submitPrice(first, 7_000_000n)).toEqual({ ok: true });
    expect(svc.submitPrice(first, 1n)).toEqual({ ok: true });
    expect(svc.priceAnswerFor(first)).toBeNull(); // already guessed: nothing left for a bot to answer
  });

  it('ends with the puzzle result when a player leaves during the price round, and skips the round when there is nothing to ask', async () => {
    const left = harness({ priceRound: true });
    const first = await left.playPuzzle();
    expect(left.svc.leave(first === 'A' ? 'B' : 'A')).toEqual({ ok: true });
    expect(matchEndedSchema.parse(left.last(first, 'match:ended')).result.reason).toBe('solved');

    const none = harness({ priceRound: true, prices: false });
    await none.playPuzzle();
    expect(matchEndedSchema.parse(none.last('A', 'match:ended')).result.reason).toBe('solved');
    expect(none.svc.activeCount).toBe(0);
  });

  it('gives a bot the real price of the open round only', async () => {
    const { svc, playPuzzle } = harness({ priceRound: true });
    const first = await playPuzzle();
    const other = first === 'A' ? 'B' : 'A';
    expect(svc.priceAnswerFor(other)).toBe(SECRET);
    expect(svc.priceAnswerFor('nobody')).toBeNull();
  });
});

describe('price-round wager', () => {
  /** A tiny in-memory ledger for the per-round wager; seats listed in `bots` are house seats. */
  function wagerHarness(balances: Record<string, number>, opts: { amount?: number; bots?: string[] } = {}) {
    const amount = opts.amount ?? 5;
    const bank = { ...balances };
    const log: string[] = [];
    const stakes = {
      open: async (_id: string, players: readonly [string, string]) => players.map((p) => (opts.bots?.includes(p) ? 'house' : 'free')) as ['free' | 'house', 'free' | 'house'],
      cancel: async () => undefined,
      settle: async () => undefined,
      wagerRules: async () => ({ amount, cutPercent: 10, isBot: (id: string) => !!opts.bots?.includes(id) }),
      takeWager: async (_m: string, round: number, user: string, n: number) => {
        if ((bank[user] ?? 0) < n) return false;
        bank[user]! -= n;
        log.push(`take:${round}:${user}`);
        return true;
      },
      creditWager: async (_m: string, round: number, user: string, coins: number) => {
        bank[user] = (bank[user] ?? 0) + coins;
        log.push(`credit:${round}:${user}:${coins}`);
      },
    };
    let t = 1_000_000;
    const timers: { at: number; fn: () => void; live: boolean }[] = [];
    const sent: { to: string; event: string; payload: unknown }[] = [];
    const svc = new MatchService({
      puzzles: source,
      profile,
      emit: (to, event, payload) => sent.push({ to, event, payload }),
      priceRound: async () => true,
      stakes,
      now: () => t,
      newSeed: () => 5,
      schedule: (ms, fn) => {
        const timer = { at: t + ms, fn, live: true };
        timers.push(timer);
        return () => (timer.live = false);
      },
    });
    const flush = () => new Promise((r) => setTimeout(r, 0));
    const last = (to: string, event: string) => sent.filter((s) => s.to === to && s.event === event).at(-1)?.payload;
    const play = async () => {
      await svc.start('A', 'B');
      const v = matchViewSchema.parse(last('A', 'match:state'));
      const first = v.turn === 0 ? 'A' : 'B';
      for (const level of [0, 1, 2]) svc.submit(first, ids(level));
      await flush();
      await flush();
      return first;
    };
    return { svc, bank, log, last, play, flush, timers, advance: (ms: number) => { t += ms; for (const x of timers.filter((y) => y.live && y.at <= t)) { x.live = false; x.fn(); } } };
  }

  it('puts both wagers down, pays the round winner the pot minus the cut, and conserves coins', async () => {
    const h = wagerHarness({ A: 100, B: 100 });
    const first = await h.play();
    const other = first === 'A' ? 'B' : 'A';
    expect(h.bank[first]).toBe(95);
    expect(matchViewSchema.parse(h.last('A', 'match:state')).priceRound).toMatchObject({ wager: 5, youIn: true });
    expect(h.bank[other]).toBe(95);
    for (let round = 0; round < 4; round++) {
      expect(h.svc.submitPrice(first, 8_000_000n)).toEqual({ ok: true }); // closer to the real 7.65M
      h.svc.submitPrice(other, 5_000_000n);
      await h.flush();
      await h.flush();
    }
    // 4 rounds won by `first`: each round pays floor(10 * 0.9) = 9, wagers of 5 each round
    expect(h.bank[first]).toBe(100 - 5 * 4 + 9 * 4);
    expect(h.bank[other]).toBe(100 - 5 * 4);
    expect(matchEndedSchema.parse(h.last(first, 'match:ended')).priceRound?.revealed).toHaveLength(4);
    expect(h.svc.activeCount).toBe(0);
  });

  it('a side that cannot afford the wager sits the round out; the other side gets its wager back', async () => {
    const h = wagerHarness({ A: 100, B: 2 });
    const first = await h.play();
    const poor = 'B';
    const rich = 'A';
    expect(h.bank[poor]).toBe(2); // nothing taken
    expect(h.svc.submitPrice(rich, 7_000_000n)).toEqual({ ok: true });
    await h.flush();
    await h.flush();
    expect(h.bank[rich]).toBe(95); // round 1: 5 down and 5 back in full (nobody to bet against); round 2 has already taken its 5
    const view = matchViewSchema.parse(h.last(rich, 'match:state'));
    expect(view.priceRound?.revealed[0]).toMatchObject({ yourGuess: '7000000', opponentGuess: null, winner: 'you' });
    expect(first).toBeDefined();
  });

  it('a bot seat plays for the house: the human risks only their own wager', async () => {
    const h = wagerHarness({ A: 100, B: 0 }, { bots: ['B'] });
    await h.play();
    expect(h.bank.A).toBe(95);
    h.svc.submitPrice('A', 1_000_000n); // far off
    h.svc.submitPrice('B', 7_600_000n);
    await h.flush();
    await h.flush();
    expect(h.bank.A).toBe(90); // lost round 1 (the bot collected nothing); round 2 has taken its 5
    expect(h.bank.B).toBe(0);
  });

  it('gives every open wager back when a player leaves mid-round', async () => {
    const h = wagerHarness({ A: 100, B: 100 });
    await h.play();
    expect(h.bank.A! + h.bank.B!).toBe(190);
    h.svc.leave('A');
    await h.flush();
    expect(h.bank.A).toBe(100);
    expect(h.bank.B).toBe(100);
  });
});
