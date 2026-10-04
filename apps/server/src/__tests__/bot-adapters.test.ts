import { describe, expect, it } from 'vitest';
import { ADAPTERS } from '../bot/adapters.js';
import { cleanText, normalizeDigits, parseInteger, validSolarYear } from '../bot/text.js';

describe('text helpers', () => {
  it('normalises Persian digits and separators', () => {
    expect(normalizeDigits('۱٬۲۳۴')).toBe('1,234');
    expect(parseInteger('۱٬۲۳۴ ریال')).toBe(1234n);
    expect(parseInteger('بدون عدد')).toBeNull();
    expect(cleanText('<b>نان&nbsp;سنگک</b>')).toBe('نان سنگک');
  });

  it('accepts only Solar Hijri years', () => {
    expect(validSolarYear(1375)).toBe(true);
    expect(validSolarYear(2019)).toBe(false);
    expect(validSolarYear(99)).toBe(false);
  });
});

describe('html_table adapter', () => {
  const html = `<table><tr><th>کالا</th><th>سال</th><th>قیمت</th><th>واحد</th></tr>
    <tr><td>نان سنگک</td><td>۱۳۷۵</td><td>۵۰۰</td><td>هر عدد</td></tr>
    <tr><td>بنزین</td><td>1390</td><td>1,000</td><td>لیتر</td></tr>
    <tr><td>خراب</td><td>2020</td><td>10</td><td></td></tr>
    <tr><td>بی‌قیمت</td><td>1380</td><td>-</td><td></td></tr></table>`;

  it('reads name, year, price and unit and converts toman to rials', () => {
    const out = ADAPTERS.html_table({ body: html, options: { name_col: '0', year_col: '1', price_col: '2', unit_col: '3', price_multiplier: '10', category: 'food' } });
    expect(out.map((c) => [c.productNameFa, c.year, c.priceRials, c.unitFa, c.categoryGuess])).toEqual([
      ['نان سنگک', 1375, 5000n, 'هر عدد', 'food'],
      ['بنزین', 1390, 10000n, 'لیتر', 'food'],
    ]);
    expect(out[0]?.excerpt).toContain('نان سنگک');
  });

  it('uses default_year when the table has no year column', () => {
    const t = '<table><tr><th>a</th><th>b</th></tr><tr><td>شیر</td><td>۲٬۰۰۰</td></tr></table>';
    const out = ADAPTERS.html_table({ body: t, options: { default_year: '1402' } });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ year: 1402, priceRials: 2000n });
  });
});

describe('csv adapter', () => {
  it('handles quotes and Persian digits', () => {
    const csv = 'name,year,price\n"چای، لیپتون",۱۳۸۰,"۱٬۵۰۰"\nشکر,1385,300\n';
    const out = ADAPTERS.csv({ body: csv, options: { name_col: '0', year_col: '1', price_col: '2' } });
    expect(out.map((c) => [c.productNameFa, c.year, c.priceRials])).toEqual([
      ['چای، لیپتون', 1380, 1500n],
      ['شکر', 1385, 300n],
    ]);
  });
});

describe('text_lines adapter', () => {
  it('extracts with named groups and ignores lines that do not match', () => {
    const body = '<p>نان سنگک ۱۳۷۵: ۵۰ ریال</p><p>متن بی‌ربط</p><p>پنیر ۱۳۸۰: ۲۰۰۰ ریال</p>';
    const out = ADAPTERS.text_lines({ body, options: { pattern: '^(?<name>.+?) (?<year>[۰-۹]{4}): (?<price>[۰-۹٬]+) ریال' } });
    expect(out.map((c) => [c.productNameFa, c.year, c.priceRials])).toEqual([
      ['نان سنگک', 1375, 50n],
      ['پنیر', 1380, 2000n],
    ]);
  });

  it('refuses a broken or oversized pattern', () => {
    expect(ADAPTERS.text_lines({ body: 'x', options: { pattern: '(' } })).toEqual([]);
    expect(ADAPTERS.text_lines({ body: 'x', options: { pattern: 'a'.repeat(301) } })).toEqual([]);
  });
});
