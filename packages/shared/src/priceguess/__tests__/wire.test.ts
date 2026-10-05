import { describe, expect, it } from 'vitest';
import { applyPriceGuessCommand, startPriceGuess } from '../competitive.js';
import { priceRoundViewSchema, toPriceRoundView } from '../wire.js';
import { chooseBotPriceGuess } from '../../bots/move.js';
import { mulberry32 } from '../../game/rng.js';

const rounds = [0, 1, 2, 3].map((level) => ({ level: level as 0 | 1 | 2 | 3, productId: `p${level}`, year: 1380 + level, actualRials: BigInt(100_000 * (level + 1)) }));
const item = (id: string) => ({ nameFa: `کالا ${id}`, unitFa: null, iconKey: null });

describe('price round wire view', () => {
  it('hides the real price and the opponent guess until the reveal, and is JSON-safe', () => {
    let s = startPriceGuess(rounds);
    s = applyPriceGuessCommand(s, { type: 'submit_guess', side: 'a', guessRials: 90_000n });
    const mine = toPriceRoundView(s, 'a', item, 1);
    const theirs = toPriceRoundView(s, 'b', item, 1);
    expect(mine.youSubmitted).toBe(true);
    expect(theirs.opponentSubmitted).toBe(true);
    expect(JSON.stringify(theirs)).not.toContain('90000');
    expect(JSON.stringify(theirs)).not.toContain('100000');
    expect(priceRoundViewSchema.parse(JSON.parse(JSON.stringify(mine)))).toEqual(mine);
  });

  it('shows both guesses and the real price after the reveal, relative to the viewer', () => {
    let s = startPriceGuess(rounds);
    s = applyPriceGuessCommand(s, { type: 'submit_guess', side: 'a', guessRials: 90_000n });
    s = applyPriceGuessCommand(s, { type: 'submit_guess', side: 'b', guessRials: 300_000n });
    const v = toPriceRoundView(s, 'b', item, 1);
    expect(v.roundIndex).toBe(1);
    expect(v.revealed).toHaveLength(1);
    expect(v.revealed[0]).toMatchObject({ actualRials: '100000', yourGuess: '300000', opponentGuess: '90000', winner: 'opponent' });
  });
});

describe('bot price guess', () => {
  it('stays near the real price for a skilled bot and is always positive', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const g = chooseBotPriceGuess({ actualRials: 1_000_000n, skill: 100, rng });
      expect(g >= 940_000n && g <= 1_060_000n).toBe(true);
      expect(chooseBotPriceGuess({ actualRials: 3n, skill: 0, rng }) > 0n).toBe(true);
    }
  });
});

describe('sit out', () => {
  it('a side that sits out has no guess and loses the round; both sitting out is a draw', () => {
    let s = startPriceGuess(rounds);
    s = applyPriceGuessCommand(s, { type: 'sit_out', side: 'a' });
    s = applyPriceGuessCommand(s, { type: 'submit_guess', side: 'b', guessRials: 1n });
    expect(s.revealed[0]).toMatchObject({ winner: 'b', guesses: { a: null } });
    let t = startPriceGuess(rounds);
    t = applyPriceGuessCommand(t, { type: 'sit_out', side: 'a' });
    t = applyPriceGuessCommand(t, { type: 'sit_out', side: 'b' });
    expect(t.revealed[0]?.winner).toBe('draw');
  });
});
