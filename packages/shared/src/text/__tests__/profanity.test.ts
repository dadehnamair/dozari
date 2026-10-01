import { describe, expect, it } from 'vitest';
import { filterText, normalizeForFilter } from '../profanity.js';

const bad = [{ word: 'بدکلمه', severity: 'block' as const }];

describe('normalizeForFilter', () => {
  it('unifies Arabic letters, drops ZWNJ/diacritics and collapses repeats', () => {
    expect(normalizeForFilter('كيان')).toBe('کیان');
    expect(normalizeForFilter('می‌رم')).toBe('میرم');
    expect(normalizeForFilter('سَلام')).toBe('سلام');
    expect(normalizeForFilter('سلاااام')).toBe('سلام');
  });
  it('maps Persian and Arabic digits and lower-cases Latin', () => {
    expect(normalizeForFilter('۱۲۳ ٤٥ ABC')).toBe('123 45 abc');
  });
  it('glues letters spaced out one by one but keeps ordinary words apart', () => {
    expect(normalizeForFilter('ب د ک ل م ه')).toBe('بدکلمه');
    expect(normalizeForFilter('ب.د.ک.ل.م.ه')).toBe('بدکلمه');
    expect(normalizeForFilter('سلام دوست من')).toBe('سلام دوست من');
  });
});

describe('filterText', () => {
  it('blocks the word however it is dressed up', () => {
    for (const t of ['بدکلمه', 'بدكلمه', 'بد‌کلمه', 'ب د ک ل م ه', 'بددددکلمه!', 'تو بدکلمه ای']) {
      expect(filterText(t, bad).ok, t).toBe(false);
    }
  });
  it('lets clean text through unchanged', () => {
    expect(filterText('سلام، حالت چطوره؟', bad)).toEqual({ ok: true, text: 'سلام، حالت چطوره؟' });
  });
  it('masks mask-severity words and reports block hits', () => {
    const r = filterText('این بدکلمه نیست', [{ word: 'بدکلمه', severity: 'mask' }]);
    expect(r).toEqual({ ok: true, text: 'این ****** نیست' });
    const blocked = filterText('x', [{ word: 'x', severity: 'block' }]);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.hit.word).toBe('x');
  });
  it('ignores empty list entries', () => {
    expect(filterText('سلام', [{ word: '  ', severity: 'block' }]).ok).toBe(true);
  });
});
