import { describe, expect, it } from 'vitest';
import { choiceVerdict } from '../choiceVerdict';

describe('choiceVerdict', () => {
  it('a right pick is green and the rest fade', () => {
    expect([0, 1, 2, 3].map((i) => choiceVerdict(i, 2, 2))).toEqual(['dim', 'dim', 'right', 'dim']);
  });
  it('a wrong pick is red and the right one is purple', () => {
    expect([0, 1, 2, 3].map((i) => choiceVerdict(i, 0, 3))).toEqual(['wrong', 'dim', 'dim', 'answer']);
  });
  it('no pick (the time ran out) still marks the right one', () => {
    expect([0, 1, 2, 3].map((i) => choiceVerdict(i, null, 1))).toEqual(['dim', 'answer', 'dim', 'dim']);
  });
});
