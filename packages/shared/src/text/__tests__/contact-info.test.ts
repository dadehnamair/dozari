import { describe, expect, it } from 'vitest';
import { containsContactInfo } from '../contact-info.js';

describe('containsContactInfo', () => {
  it('catches phone numbers however they are written', () => {
    for (const t of ['زنگ بزن 09123456789', 'شمارم ۰۹۱۲۳۴۵۶۷۸۹', '0912 345 67 89', '0912-345-6789', '+98 912 345 6789', '٠٩١٢٣٤٥٦٧٨٩ بزن']) expect(containsContactInfo(t)).toBe(true);
  });
  it('catches links and messenger handles', () => {
    for (const t of ['https://example.com', 'www.site.ir', 'بیا اینجا dozari.ir', 'پیام بده @ali_123', 'تلگرام: ali123', 'ble.ir/abc', 'instagram']) expect(containsContactInfo(t)).toBe(true);
  });
  it('lets ordinary game talk through', () => {
    for (const t of ['سلام! آماده‌ای ببازی؟', 'این یکی رو ۳ بار حدس زدم', 'قیمت پیکان ۱۳۷۵ بود ۲۵۰۰۰ تومن', 'دمت گرم 👏', 'سطح ۱۲ شدم', 'بیا ساعت ۸ بازی کنیم']) expect(containsContactInfo(t)).toBe(false);
  });
});
