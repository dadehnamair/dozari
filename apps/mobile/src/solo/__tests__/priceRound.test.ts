import { describe, expect, it } from 'vitest';
import { priceText, questionText, totalPoints } from '../priceRound';

describe('price round helpers', () => {
  it('writes the year in Persian digits without grouping', () => {
    expect(questionText('سال {year}؟', 1400)).toBe('سال ۱۴۰۰؟');
  });
  it('shows rials as toman', () => {
    expect(priceText('15000')).toBe('۱٫۵ هزار تومن');
  });
  it('sums points', () => {
    expect(totalPoints([{ points: 5 }, { points: 2 }, { points: 1 }])).toBe(8);
    expect(totalPoints([])).toBe(0);
  });
});
