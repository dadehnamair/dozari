import { describe, expect, it } from 'vitest';
import type { SoloChart } from '@dozari/shared';
import { shareLine } from '../shareLine';

const group = (over: Partial<SoloChart['groups'][number]>): SoloChart['groups'][number] => ({
  level: 0,
  titleFa: 'گروه',
  items: [
    { productId: 'a', nameFa: 'نان', points: [{ year: 1375, month: null, priceRials: '1000' }, { year: 1390, month: null, priceRials: '50000' }] },
    { productId: 'b', nameFa: 'شیر', points: [{ year: 1375, month: null, priceRials: '2500' }] },
  ],
  ...over,
});

describe('share card line', () => {
  it('names the cheapest product at the rule year', () => {
    expect(shareLine(group({ ruleYear: 1375 }))).toBe('سال ۷۵ با ۱۰۰ تومن می‌شد نان خرید!');
  });
  it('falls back to the earliest year when the rule year has no price', () => {
    expect(shareLine(group({ ruleYear: 1399 }))).toBe('سال ۷۵ با ۱۰۰ تومن می‌شد نان خرید!');
    expect(shareLine(group({}))).toBe('سال ۷۵ با ۱۰۰ تومن می‌شد نان خرید!');
  });
  it('uses the full year after 1399 and is null without prices', () => {
    expect(shareLine(group({ items: [{ productId: 'x', nameFa: 'بنزین', points: [{ year: 1402, month: null, priceRials: '50000' }] }] }))).toBe('سال ۱۴۰۲ با ۵ هزار می‌شد بنزین خرید!');
    expect(shareLine(group({ items: [] }))).toBeNull();
  });
});
