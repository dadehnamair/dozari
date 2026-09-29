import { describe, expect, it } from 'vitest';
import { rialsToTomanString } from '../toman.js';

describe('rialsToTomanString', () => {
  it('shows sub-toman prices in rials', () => {
    expect(rialsToTomanString(5)).toBe('۵ ریال');
  });

  it('shows plain toman for amounts under 1,000 toman', () => {
    expect(rialsToTomanString(1_500)).toBe('۱۵۰ تومن'); // 1500 rials = 150 toman
  });

  it('shows thousands of toman for amounts under 1,000,000 toman', () => {
    expect(rialsToTomanString(1_000_000)).toBe('۱۰۰ هزار تومن'); // 100,000 toman
  });

  it('shows millions of toman for large amounts', () => {
    expect(rialsToTomanString(320_000_000)).toBe('۳۲ میلیون تومن'); // 32,000,000 toman
  });

  it('shows billions of toman for apartment-scale prices', () => {
    expect(rialsToTomanString(320_000_000_000)).toBe('۳۲ میلیارد تومن'); // 32,000,000,000 toman
  });

  it('accepts a bigint directly', () => {
    expect(rialsToTomanString(1_500n)).toBe('۱۵۰ تومن');
  });

  it('rejects zero or negative prices', () => {
    expect(() => rialsToTomanString(0)).toThrow();
    expect(() => rialsToTomanString(-10)).toThrow();
  });
});
