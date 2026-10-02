import { describe, expect, it } from 'vitest';
import { availableTips, nextTip } from '../guideTips';

describe('guide tips', () => {
  it('drops tips of switched-off features', () => {
    const tips = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
    expect(availableTips(tips, new Set(['b'])).map((t) => t.key)).toEqual(['a', 'c']);
  });

  it('starts at the first tip, wraps around, and is null with nothing to say', () => {
    expect(nextTip(null, 3)).toBe(0);
    expect(nextTip(2, 3)).toBe(0);
    expect(nextTip(0, 0)).toBeNull();
  });
});
