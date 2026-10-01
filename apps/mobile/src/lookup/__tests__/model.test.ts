import { describe, expect, it } from 'vitest';
import { dateLabel, rangeLine, yearsWithData } from '../model';

describe('lookup model', () => {
  it('formats dates with Persian digits and an optional month', () => {
    expect(dateLabel({ year: 1375, month: null })).toBe('۱۳۷۵');
    expect(dateLabel({ year: 1375, month: 6 })).toBe('۱۳۷۵/۶');
  });
  it('has no range line without approved data', () => expect(rangeLine(null)).toBeNull());
  it('builds the range line', () => {
    const mark = (year: number, priceRials: string) => ({ year, month: null, priceRials });
    const line = rangeLine({ count: 2, first: mark(1357, '1000'), last: mark(1390, '90000'), min: mark(1357, '1000'), max: mark(1390, '90000') });
    expect(line).toContain('۱۳۵۷ تا ۱۳۹۰');
    expect(line).toContain('تومن');
  });
  it('lists distinct years oldest first', () => {
    const p = (year: number) => ({ year, month: null, priceRials: '1', sourceType: 'other', confidence: 2 });
    expect(yearsWithData([p(1390), p(1375), p(1390)])).toEqual([1375, 1390]);
  });
});
