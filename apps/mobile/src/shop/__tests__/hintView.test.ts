import { describe, expect, it } from 'vitest';
import type { HintPayload } from '@dozari/shared';
import { hintBlockedText, hintedCardIds, hintedTitles } from '../hintView';

const given: HintPayload[] = [
  { kind: 'group_title', level: 0, titleFa: 'قیمت دوران جنگ' },
  { kind: 'one_card', level: 1, productId: 'a' },
  { kind: 'pair', level: 2, productIds: ['b', 'c'] },
];

describe('hint view helpers', () => {
  it('collects framed cards and revealed titles', () => {
    expect(hintedCardIds(given)).toEqual(['a', 'b', 'c']);
    expect(hintedTitles(given)).toEqual(['قیمت دوران جنگ']);
  });
  it('explains a block in Persian', () => {
    expect(hintBlockedText({ blocked: 'LEVEL', minLevel: 2, max: 2 })).toBe('راهنما از سطح ۲ باز می‌شود.');
    expect(hintBlockedText({ blocked: 'LIMIT', minLevel: 2, max: 2 })).toBe('در هر بازی حداکثر ۲ راهنما می‌شود گرفت.');
    expect(hintBlockedText({ blocked: null, minLevel: 2, max: 2 })).toBeNull();
  });
});
