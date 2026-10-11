import { NICKNAMES } from '../identity/index.js';
import type { Rng } from '../game/rng.js';

/** Everyday given names and short handles Iranian players pick; with the preset nicknames it is the base of the pool bot names come from. */
const BASE_NAMES: readonly string[] = [
  ...NICKNAMES,
  'علی‌آقا', 'مریم‌خانم', 'رضا', 'نگار', 'پویا', 'سارا', 'امیر', 'مهسا', 'کیان', 'نیلوفر', 'بهزاد', 'ترانه', 'آرمان', 'شقایق', 'سینا', 'ندا',
  'محمد', 'زهرا', 'حسین', 'فاطمه', 'مهدی', 'الهه', 'یاسر', 'پریسا', 'کامران', 'آزاده', 'فرهاد', 'شبنم', 'بابک', 'ساناز', 'داریوش', 'مینا',
  'تینا', 'رها', 'آیدین', 'نازنین', 'سهراب', 'گلناز', 'ارسلان', 'یلدا', 'پدرام', 'هستی', 'کاوه', 'بهار', 'نیما', 'سمیرا', 'حامد', 'لیلا',
  'دوزاری‌کار', 'بازیکن‌قدیمی', 'ستاره‌ی‌شب', 'شاهزاده', 'گرگ‌تنها', 'سایه', 'آفتاب', 'مسافر', 'رویاپرداز', 'کوچولو',
];

/** More given names; the pool combines them with the suffixes below so a roster of several hundred bots still gets distinct, ordinary-looking names. */
const MORE_GIVEN_NAMES: readonly string[] = [
  'احسان', 'اکبر', 'امین', 'امید', 'ایمان', 'بردیا', 'بهروز', 'بهنام', 'پارسا', 'پیمان', 'تورج', 'جواد', 'جمشید', 'حمید', 'حمیدرضا', 'خشایار',
  'دانیال', 'رامین', 'رضا', 'روزبه', 'سعید', 'سجاد', 'سروش', 'سیامک', 'شهرام', 'صادق', 'عباس', 'عرفان', 'غلام', 'فرزاد', 'فرید', 'کارن',
  'کریم', 'کوروش', 'مجید', 'محسن', 'مسعود', 'مصطفی', 'منوچهر', 'مهران', 'میلاد', 'ناصر', 'نوید', 'هادی', 'همایون', 'وحید', 'یاشار', 'یوسف',
  'آتنا', 'آذر', 'آرزو', 'آسیه', 'الناز', 'الهام', 'ام‌البنین', 'ترنم', 'پرستو', 'پروین', 'پگاه', 'توران', 'ثریا', 'جمیله', 'چکاوک', 'حدیث',
  'خدیجه', 'دلارام', 'رعنا', 'رویا', 'ریحانه', 'زینب', 'ژاله', 'سحر', 'سمانه', 'سپیده', 'شادی', 'شیرین', 'شیما', 'صبا', 'طاهره', 'عاطفه',
  'غزل', 'فرناز', 'فروغ', 'کتایون', 'گلاره', 'مائده', 'مرجان', 'ملیکا', 'منیژه', 'مهتاب', 'نرگس', 'نسترن', 'نسیم', 'نغمه', 'هانیه', 'هما',
  'اصغر', 'تقی', 'جعفر', 'حسن', 'خسرو', 'رحیم', 'زکریا', 'سلمان', 'شاپور', 'قاسم', 'کاظم', 'ماکان', 'نادر', 'هوشنگ', 'یدالله', 'اسماعیل',
];

const SUFFIXES: readonly string[] = ['جان', 'خان', 'جون', 'آقا', 'خانم'];

const faDigits = (n: number): string => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)] as string);

const GIVEN_NAMES = [...new Set([...BASE_NAMES, ...MORE_GIVEN_NAMES])];

/** Deterministic variants: «name_birthyear» handles (1360–1399) and «name+suffix» forms, never random so tests and admin previews are stable. */
const VARIANTS: string[] = GIVEN_NAMES.flatMap((n, i) => [`${n}_${faDigits(1360 + ((i * 7) % 40))}`, `${n}${SUFFIXES[i % SUFFIXES.length]}`]);

export const BOT_NAME_POOL: readonly string[] = [...new Set([...GIVEN_NAMES, ...VARIANTS])];

/** `count` distinct names that are not in `taken`, or fewer when the pool runs out. */
export function pickBotNames(count: number, taken: ReadonlySet<string>, rng: Rng): string[] {
  const free = BOT_NAME_POOL.filter((n) => !taken.has(n));
  const out: string[] = [];
  while (out.length < count && free.length > 0) out.push(free.splice(Math.floor(rng() * free.length), 1)[0] as string);
  return out;
}
