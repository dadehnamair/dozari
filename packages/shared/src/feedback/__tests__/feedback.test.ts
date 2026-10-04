import { describe, expect, it } from 'vitest';
import { expandYear, submissionInputSchema, toRials } from '../contract.js';

describe('expandYear', () => {
  it('reads two-digit years the way the spec says', () => {
    expect(expandYear(75)).toBe(1375);
    expect(expandYear(99)).toBe(1399);
    expect(expandYear(0)).toBe(1400);
    expect(expandYear(5)).toBe(1405);
    expect(expandYear(1380)).toBe(1380);
    expect(expandYear(2024)).toBeNull();
    expect(expandYear(-1)).toBeNull();
  });
});

describe('submissionInputSchema', () => {
  it('needs the fields of its kind', () => {
    expect(submissionInputSchema.safeParse({ kind: 'item', nameFa: 'پفک', category: 'snack', year: 1375, price: 50 }).success).toBe(true);
    expect(submissionInputSchema.safeParse({ kind: 'item', nameFa: 'پفک' }).success).toBe(false);
    expect(submissionInputSchema.safeParse({ kind: 'price_point', productId: '0190a2c0-0000-7000-8000-000000000001', year: 1380, price: 100 }).success).toBe(true);
    expect(submissionInputSchema.safeParse({ kind: 'price_report', productId: '0190a2c0-0000-7000-8000-000000000001' }).success).toBe(false);
    expect(submissionInputSchema.safeParse({ kind: 'price_report', productId: '0190a2c0-0000-7000-8000-000000000001', note: 'خیلی گرانه' }).success).toBe(true);
  });
  it('converts toman to rials', () => {
    expect(toRials(50, 'toman')).toBe(500);
    expect(toRials(500, 'rial')).toBe(500);
  });
});
