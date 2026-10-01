import { describe, expect, it } from 'vitest';
import { soloGuessResultSchema, soloViewSchema } from '../contract.js';

const view = {
  sessionId: 's',
  puzzleId: 'p',
  cards: [{ id: 'a', nameFa: 'نان', unitFa: null }],
  solved: [{ level: 2, titleFa: 't', explanationFa: 'e', productIds: ['x'], revealed: false }],
  mistakes: 1,
  maxMistakes: 4,
  status: 'playing',
};

describe('solo wire contract', () => {
  it('accepts a well-formed view and guess result', () => {
    expect(soloViewSchema.safeParse(view).success).toBe(true);
    expect(soloGuessResultSchema.safeParse({ outcome: 'one_away', view }).success).toBe(true);
    expect(soloGuessResultSchema.safeParse({ outcome: 'correct', solvedLevel: 1, view }).success).toBe(true);
  });

  it('rejects bad levels, statuses and outcomes', () => {
    expect(soloViewSchema.safeParse({ ...view, status: 'done' }).success).toBe(false);
    expect(soloViewSchema.safeParse({ ...view, solved: [{ ...view.solved[0], level: 4 }] }).success).toBe(false);
    expect(soloGuessResultSchema.safeParse({ outcome: 'nope', view }).success).toBe(false);
  });
});
