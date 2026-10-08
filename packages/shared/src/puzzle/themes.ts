/**
 * Theme groups: non-price associations a product can carry («تو آشپزخونه لازمه», «مامانم قایمش می‌کرد»…).
 * A product belongs to a theme through the free-text tag `theme:<key>` in its tags (same table as era tags, no schema change);
 * the `theme_tag` rule is "carries this tag". The tags are curated by hand, so a theme group is human-judged data, not price data.
 */

export interface ThemeDef {
  key: string;
  /** Plain explanation shown when the group is solved. */
  explanationFa: string;
  /** Draft titles (the admin picks/edits one); several per theme so batches do not repeat. */
  titlesFa: readonly string[];
}

export const THEME_TAG_PREFIX = 'theme:';

export const THEMES: readonly ThemeDef[] = [
  { key: 'kitchen', explanationFa: 'همه‌شان توی آشپزخانه لازم بودند', titlesFa: ['توی آشپزخونه لازمه', 'بدون این‌ها آشپزخونه نمی‌چرخید', 'ملزومات مامان‌پز'] },
  { key: 'storeroom', explanationFa: 'همه‌شان گوشه‌ی انباری خاک می‌خوردند', titlesFa: ['تو انباری نباشه نمیشه', 'قبرستان خاطره‌ها: انباری', 'بالای کمدِ انباری یکی‌شان هست'] },
  { key: 'repairman', explanationFa: 'همه‌شان توی جعبه‌ی یک تعمیرکار پیدا می‌شدند', titlesFa: ['یه تعمیرکار اساس دستشه', 'جعبه‌ی ابزارِ استاد', 'استاد‌کار بدون این‌ها کار نمی‌کرد'] },
  { key: 'mom_hid', explanationFa: 'مامان‌ها همه‌شان را از دست بچه‌ها قایم می‌کردند', titlesFa: ['مامانم همشو قایم می‌کرد', 'بالای کمد، پشتِ ظرف‌ها', 'تا مهمون بیاد دست نزنین!'] },
  { key: 'school_bag', explanationFa: 'همه‌شان توی کیف مدرسه بودند', titlesFa: ['تو کیف مدرسه‌ی هر بچه', 'زنگ اول، کیف را خالی کن', 'اگر یادت رفته بود، معلم می‌پرسید'] },
  { key: 'pocket', explanationFa: 'همه‌شان توی جیب بچه‌های کوچه پیدا می‌شدند', titlesFa: ['جیب شلوار بچه‌های کوچه', 'ته جیب را بگرد', 'دارایی بچه‌ی کوچه'] },
  { key: 'bathroom', explanationFa: 'همه‌شان توی حمام و دست‌شویی لازم بودند', titlesFa: ['کنار لگن حمام', 'ملزومات حموم هفتگی', 'بوی کف حمام'] },
  { key: 'travel', explanationFa: 'همه‌شان توی سفر لازم بودند', titlesFa: ['توی ساک سفر', 'تعطیلات نوروز، جاده', 'قبل از رفتن چک کن'] },
  { key: 'guests', explanationFa: 'همه‌شان برای مهمان آماده می‌شدند', titlesFa: ['مهمون که می‌آمد', 'روی میز پذیرایی', 'ظرف مخصوص مهمان'] },
  { key: 'street_food', explanationFa: 'همه‌شان را کنار خیابان می‌خوردیم', titlesFa: ['خوراکِ سرِ کوچه', 'بغل خیابان می‌خوردیم', 'پای دکه'] },
  { key: 'iftar', explanationFa: 'همه‌شان سر سفره‌ی ماه رمضان بودند', titlesFa: ['سفره‌ی سحر و افطار', 'اذان که می‌گفتند', 'ماه رمضان بی‌این‌ها نمی‌شد'] },
  { key: 'breakfast', explanationFa: 'همه‌شان سر سفره‌ی صبحانه بودند', titlesFa: ['سفره‌ی صبحانه‌ی جمعه', 'صبح که بیدار می‌شدی', 'لقمه‌ی صبح'] },
  { key: 'afternoon_fun', explanationFa: 'همه‌شان وقت‌گذرانی بعدازظهر بچه‌ها بودند', titlesFa: ['بعدازظهرهای بدون موبایل', 'بازی تا اذان مغرب', 'تفریح قبل از اینترنت'] },
  { key: 'gift', explanationFa: 'همه‌شان کادوی معمول مناسبت‌ها بودند', titlesFa: ['کادوی دم‌دستی', 'بسته‌بندی که می‌کردیم', 'عیدی که نمی‌شد دست خالی رفت'] },
  { key: 'road', explanationFa: 'همه‌شان با خیابان و جاده سر و کار داشتند', titlesFa: ['خیابان و جاده', 'تو ترافیک بودیم', 'پشت فرمان یا سرِ پمپ'] },
  { key: 'winter', explanationFa: 'همه‌شان به زمستان و سرما می‌خوردند', titlesFa: ['زمستان‌های سرد', 'کرسی و سرما', 'برف که می‌آمد'] },
  { key: 'reading', explanationFa: 'همه‌شان خواندنی بودند', titlesFa: ['خواندنی‌های بی‌اینترنت', 'ورق می‌زدیم', 'کنار چراغ مطالعه'] },
];

const BY_KEY: ReadonlyMap<string, ThemeDef> = new Map(THEMES.map((t) => [t.key, t]));

export const themeDef = (key: string): ThemeDef | undefined => BY_KEY.get(key);
export const themeTagOf = (key: string): string => `${THEME_TAG_PREFIX}${key}`;
export const isThemeTag = (tag: string): boolean => tag.startsWith(THEME_TAG_PREFIX);
