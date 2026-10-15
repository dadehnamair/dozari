import { describe, expect, it } from 'vitest';
import { MAX_CONTACT_NUMBERS, iranianMobile, pickContacts, pickMobiles } from '../contactNumbers';

describe('contact numbers', () => {
  it('normalises Iranian mobiles written in many ways', () => {
    for (const raw of ['09123456789', '+98 912 345 6789', '0098-912-345-6789', '9123456789', '۰۹۱۲۳۴۵۶۷۸۹', '(0912) 345 6789']) expect(iranianMobile(raw)).toBe('09123456789');
  });
  it('drops landlines, foreign numbers and junk', () => {
    for (const raw of ['02188776655', '+1 415 555 0100', '123', '', 'ali']) expect(iranianMobile(raw)).toBeNull();
  });
  it('keeps unique numbers and caps the upload', () => {
    expect(pickMobiles(['0912 345 6789', '+989123456789', '021 111'])).toEqual(['09123456789']);
    const many = Array.from({ length: 700 }, (_, i) => `0912${String(1000000 + i)}`);
    expect(pickMobiles(many)).toHaveLength(MAX_CONTACT_NUMBERS);
  });

  it('keeps the contact name next to each mobile, first name wins', () => {
    expect(pickContacts([{ name: ' علی ', numbers: ['0912 345 6789', '021 111'] }, { name: 'دیگری', numbers: ['+989123456789'] }, { name: null, numbers: ['09351112233'] }])).toEqual([
      { phone: '09123456789', name: 'علی' },
      { phone: '09351112233', name: '' },
    ]);
  });
});
