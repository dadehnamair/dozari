import { describe, expect, it } from 'vitest';
import { canSubmit, feedbackFor, pruneSelection, toggleSelection } from '../selection.js';

describe('toggleSelection', () => {
  it('selects, deselects and caps at four', () => {
    let s: string[] = [];
    for (const id of ['a', 'b', 'c', 'd']) s = toggleSelection(s, id);
    expect(s).toEqual(['a', 'b', 'c', 'd']);
    expect(toggleSelection(s, 'e')).toEqual(['a', 'b', 'c', 'd']);
    expect(toggleSelection(s, 'b')).toEqual(['a', 'c', 'd']);
  });

  it('never mutates its input', () => {
    const s = ['a'];
    toggleSelection(s, 'b');
    expect(s).toEqual(['a']);
  });
});

describe('selection helpers', () => {
  it('only allows submitting exactly four', () => {
    expect(canSubmit(['a', 'b', 'c'])).toBe(false);
    expect(canSubmit(['a', 'b', 'c', 'd'])).toBe(true);
  });

  it('prunes cards that left the board', () => {
    const cards = [{ id: 'a', nameFa: 'x', unitFa: null, iconKey: null }, { id: 'c', nameFa: 'y', unitFa: null, iconKey: null }];
    expect(pruneSelection(['a', 'b', 'c'], cards)).toEqual(['a', 'c']);
  });

  it('maps outcomes to feedback, silently ignoring invalid', () => {
    expect(feedbackFor('one_away')).toBe('oneAway');
    expect(feedbackFor('correct')).toBe('correct');
    expect(feedbackFor('invalid')).toBeNull();
  });
});
