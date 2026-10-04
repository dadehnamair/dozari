import { describe, expect, it } from 'vitest';
import { buildSubmission, typedWhole } from '../suggestInput';
import type { SuggestFields } from '../suggestInput';

const base: SuggestFields = { kind: 'item', nameFa: 'شکلات هوپر', category: 'snack', year: '۷۵', price: '۱٬۲۰۰', unit: 'toman', source: 'user_memory', sourceText: '', note: '' };

describe('typedWhole', () => {
  it('reads any digit style and separators', () => {
    expect(typedWhole('۱٬۲۰۰')).toBe(1200);
    expect(typedWhole('1,200')).toBe(1200);
    expect(typedWhole('abc')).toBeNull();
    expect(typedWhole('')).toBeNull();
  });
});

describe('buildSubmission', () => {
  it('expands a two-digit year and keeps the unit for the server', () => {
    expect(buildSubmission(base)).toMatchObject({ kind: 'item', year: 1375, price: 1200, unit: 'toman' });
  });
  it('is null while a required part is missing or a number is nonsense', () => {
    expect(buildSubmission({ ...base, nameFa: '' })).toBeNull();
    expect(buildSubmission({ ...base, year: '2024' })).toBeNull();
    expect(buildSubmission({ ...base, price: '۰' })).toBeNull();
  });
  it('a price report may be just a note', () => {
    expect(buildSubmission({ ...base, kind: 'price_report', productId: '0190a2c0-0000-7000-8000-000000000001', nameFa: '', category: null, year: '', price: '', note: 'غلطه' })).toMatchObject({ kind: 'price_report', note: 'غلطه' });
  });
});
