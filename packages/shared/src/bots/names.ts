import { NICKNAMES } from '../identity/index.js';
import type { Rng } from '../game/rng.js';

/** Everyday given names and short handles Iranian players pick; with the preset nicknames it is the pool bot names come from. */
export const BOT_NAME_POOL: readonly string[] = [
  ...NICKNAMES,
  'علی‌آقا', 'مریم‌خانم', 'رضا', 'نگار', 'پویا', 'سارا', 'امیر', 'مهسا', 'کیان', 'نیلوفر', 'بهزاد', 'ترانه', 'آرمان', 'شقایق', 'سینا', 'ندا',
  'محمد', 'زهرا', 'حسین', 'فاطمه', 'مهدی', 'الهه', 'یاسر', 'پریسا', 'کامران', 'آزاده', 'فرهاد', 'شبنم', 'بابک', 'ساناز', 'داریوش', 'مینا',
  'تینا', 'رها', 'آیدین', 'نازنین', 'سهراب', 'گلناز', 'ارسلان', 'یلدا', 'پدرام', 'هستی', 'کاوه', 'بهار', 'نیما', 'سمیرا', 'حامد', 'لیلا',
  'دوزاری‌کار', 'بازیکن‌قدیمی', 'ستاره‌ی‌شب', 'شاهزاده', 'گرگ‌تنها', 'سایه', 'آفتاب', 'مسافر', 'رویاپرداز', 'کوچولو',
];

/** `count` distinct names that are not in `taken`, or fewer when the pool runs out. */
export function pickBotNames(count: number, taken: ReadonlySet<string>, rng: Rng): string[] {
  const free = BOT_NAME_POOL.filter((n) => !taken.has(n));
  const out: string[] = [];
  while (out.length < count && free.length > 0) out.push(free.splice(Math.floor(rng() * free.length), 1)[0] as string);
  return out;
}
