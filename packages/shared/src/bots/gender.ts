import { AVATAR_KEYS } from '../identity/index.js';
import type { Rng } from '../game/rng.js';

/** Given names (and the odd preset handle) that read as a woman's or a man's; everything else — handles, unisex names — is neutral and may wear any face. */
export const FEMALE_NAMES: ReadonlySet<string> = new Set([
  'نگار', 'سارا', 'مهسا', 'نیلوفر', 'ترانه', 'شقایق', 'ندا', 'زهرا', 'فاطمه', 'الهه', 'پریسا', 'آزاده', 'شبنم', 'ساناز', 'مینا', 'تینا', 'نازنین', 'گلناز', 'یلدا', 'سمیرا', 'لیلا', 'مریم‌خانم', 'تومن‌بانو',
  'آتنا', 'آذر', 'آرزو', 'آسیه', 'الناز', 'الهام', 'ام‌البنین', 'ترنم', 'پرستو', 'پروین', 'پگاه', 'توران', 'ثریا', 'جمیله', 'چکاوک', 'حدیث',
  'خدیجه', 'دلارام', 'رعنا', 'رویا', 'ریحانه', 'زینب', 'ژاله', 'سحر', 'سمانه', 'سپیده', 'شادی', 'شیرین', 'شیما', 'صبا', 'طاهره', 'عاطفه',
  'غزل', 'فرناز', 'فروغ', 'کتایون', 'گلاره', 'مائده', 'مرجان', 'ملیکا', 'منیژه', 'مهتاب', 'نرگس', 'نسترن', 'نسیم', 'نغمه', 'هانیه', 'هما',
]);
export const MALE_NAMES: ReadonlySet<string> = new Set([
  'علی‌آقا', 'رضا', 'پویا', 'امیر', 'کیان', 'بهزاد', 'آرمان', 'سینا', 'محمد', 'حسین', 'مهدی', 'یاسر', 'کامران', 'فرهاد', 'بابک', 'داریوش', 'آیدین', 'سهراب', 'ارسلان', 'پدرام', 'کاوه', 'نیما', 'حامد', 'شاهی‌خان', 'ریال‌آقا',
  'احسان', 'اکبر', 'امین', 'امید', 'ایمان', 'بردیا', 'بهروز', 'بهنام', 'پارسا', 'پیمان', 'تورج', 'جواد', 'جمشید', 'حمید', 'حمیدرضا', 'خشایار',
  'دانیال', 'رامین', 'روزبه', 'سعید', 'سجاد', 'سروش', 'سیامک', 'شهرام', 'صادق', 'عباس', 'عرفان', 'غلام', 'فرزاد', 'فرید', 'کارن',
  'کریم', 'کوروش', 'مجید', 'محسن', 'مسعود', 'مصطفی', 'منوچهر', 'مهران', 'میلاد', 'ناصر', 'نوید', 'هادی', 'همایون', 'وحید', 'یاشار', 'یوسف',
  'اصغر', 'تقی', 'جعفر', 'حسن', 'خسرو', 'رحیم', 'زکریا', 'سلمان', 'شاپور', 'قاسم', 'کاظم', 'ماکان', 'نادر', 'هوشنگ', 'یدالله', 'اسماعیل',
]);

export const NAME_SUFFIXES = ['جان', 'خان', 'جون', 'آقا', 'خانم'] as const;
/** Suffixes that fit a man's / a woman's / a neutral name («نگارآقا» would read wrong). */
export const SUFFIXES_OF = { male: ['جان', 'خان', 'جون', 'آقا'], female: ['جان', 'جون', 'خانم'], neutral: ['جان', 'جون'] } as const;

export type NameGender = 'female' | 'male';

/** The gender a bot nickname reads as, or null when it is neutral («سایه»، «رها»). Handles «name_۱۳۷۰» and «name+suffix» forms. */
export function nameGender(name: string): NameGender | null {
  const base = (name.split('_')[0] ?? name).trim();
  if (FEMALE_NAMES.has(base)) return 'female';
  if (MALE_NAMES.has(base)) return 'male';
  for (const s of NAME_SUFFIXES) {
    if (!base.endsWith(s) || base.length === s.length) continue;
    const given = base.slice(0, -s.length);
    if (FEMALE_NAMES.has(given)) return 'female';
    if (MALE_NAMES.has(given)) return 'male';
  }
  return null;
}

/** Cast faces (`char-<id>`) by gender; the mascots stay out. */
export const FEMALE_FACES: readonly string[] = ['char-goli', 'char-khale', 'char-dozariF'];
export const MALE_FACES: readonly string[] = ['char-pahlevan', 'char-baqal', 'char-mashti', 'char-mirza', 'char-dozari'];

const FACE_GENDER = new Map<string, NameGender>([...FEMALE_FACES.map((k) => [k, 'female'] as const), ...MALE_FACES.map((k) => [k, 'male'] as const)]);

/**
 * The market character an app shows for a plain `avatar-NN` key: the same hash as `characterFor` in the app (`duel/arena.ts`), over the
 * same six rivals. Kept here so a face can be judged without the app.
 */
const RIVAL_FACES = ['char-pahlevan', 'char-baqal', 'char-mashti', 'char-khale', 'char-mirza', 'char-goli'] as const;
export function shownFace(avatarKey: string): string {
  if (avatarKey.startsWith('char-')) return avatarKey;
  let h = 0;
  for (let i = 0; i < avatarKey.length; i++) h = (h * 31 + avatarKey.charCodeAt(i)) >>> 0;
  return RIVAL_FACES[h % RIVAL_FACES.length] as string;
}

/** Gender of the face a key shows, or null for a face without one. */
export const faceGender = (avatarKey: string): NameGender | null => FACE_GENDER.get(shownFace(avatarKey)) ?? null;

/** A face that fits the gender; any face for a neutral name. */
export function botFaceFor(gender: NameGender | null, rng: Rng, not?: string): string {
  const pool = gender === 'female' ? FEMALE_FACES : gender === 'male' ? MALE_FACES : [...FEMALE_FACES, ...MALE_FACES, ...AVATAR_KEYS];
  const choices = pool.filter((k) => k !== not);
  return (choices[Math.floor(rng() * choices.length)] ?? pool[0]) as string;
}

/** What to fix on a bot whose face or stored gender contradicts its name; null when it already reads right (or its name is neutral). */
export function genderRepair(bot: { nickname: string; avatarKey: string; gender: NameGender | null }, rng: Rng): { avatarKey?: string; gender?: NameGender } | null {
  const g = nameGender(bot.nickname);
  if (!g) return null;
  const fix: { avatarKey?: string; gender?: NameGender } = {};
  if (faceGender(bot.avatarKey) !== g) fix.avatarKey = botFaceFor(g, rng);
  if (bot.gender !== g) fix.gender = g;
  return Object.keys(fix).length > 0 ? fix : null;
}
