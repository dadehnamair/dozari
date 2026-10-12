import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../game/rng.js';
import { openTopics, resolveTopicPick, topicChooserForRound } from '../pick.js';

describe('topicChooserForRound', () => {
  it('alternates, starting with the first chooser', () => {
    expect([1, 2, 3, 4].map((r) => topicChooserForRound(r, 4, 0))).toEqual([0, 1, 0, 1]);
    expect([1, 2, 3, 4].map((r) => topicChooserForRound(r, 4, 1))).toEqual([1, 0, 1, 0]);
  });
  it('leaves the last round of an odd count to the system', () => {
    expect([1, 2, 3].map((r) => topicChooserForRound(r, 3, 0))).toEqual([0, 1, 'system']);
    expect(topicChooserForRound(5, 5, 1)).toBe('system');
  });
  it('rejects fewer than three rounds and out-of-range rounds', () => {
    expect(() => topicChooserForRound(1, 2, 0)).toThrow(RangeError);
    expect(() => topicChooserForRound(4, 3, 0)).toThrow(RangeError);
  });
});

describe('topic picks', () => {
  const all = ['food', 'tools', 'kitchen'];
  it('closes used topics', () => {
    expect(openTopics(all, ['tools'])).toEqual(['food', 'kitchen']);
  });
  it('resolves a named pick only while open', () => {
    const rng = mulberry32(1);
    expect(resolveTopicPick('food', ['food', 'kitchen'], rng)).toBe('food');
    expect(resolveTopicPick('tools', ['food', 'kitchen'], rng)).toBeNull();
  });
  it('draws for random and for the system, deterministically', () => {
    const open = ['food', 'tools', 'kitchen'];
    expect(resolveTopicPick('random', open, mulberry32(7))).toBe(resolveTopicPick(null, open, mulberry32(7)));
    expect(resolveTopicPick(null, [], mulberry32(7))).toBeNull();
  });
});
