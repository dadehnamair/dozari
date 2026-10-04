import { describe, expect, it } from 'vitest';
import { fa } from '../fa.js';

describe('fa i18n strings', () => {
  it('has the placeholder home strings', () => {
    expect(fa.home.title).toBe('دوزاری');
  });
});

describe('solo strings', () => {
  it('has a message for every feedback the board can show', () => {
    expect(Object.keys(fa.solo.feedback).sort()).toEqual(['correct', 'duplicate', 'oneAway', 'wrong']);
  });
});
