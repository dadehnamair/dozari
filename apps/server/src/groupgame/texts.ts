/** What the bot says inside groups. Persian only (a bot surface, separate from the app's `fa.ts`). */
export const GROUP_TEXT = {
  welcome: 'سلام! من «دوزاری» هستم 🪙\nبازی حدس قیمت‌های قدیمی ایران: ۱۶ کارت، ۴ دسته‌ی چهارتایی که باید با هم پیدا کنید.\n\n/play پازل امروز گروه\n/price قیمت‌شناسی\n/table میز اختصاصی\n/top جدول هفته\n/help راهنما',
  help: 'راهنمای دوزاری 🧩\n۱۶ کارت روی صفحه است و ۴ دسته‌ی چهارتایی دارد که یک چیز مشترک دارند (مثلاً قیمتشان در یک سال).\nکارت‌ها را بزنید تا ✅ شوند، وقتی ۴ تا شد «ثبت» را بزنید. همه‌ی اعضا روی یک صفحه بازی می‌کنند و ۴ اشتباه مجاز است.\nروزی یک پازل برای هر گروه.\n\n/play شروع پازل امروز\n/price پنج سؤال قیمت (روزی دو بار)\n/table CODE کارت میز اختصاصی (میز را در اپ بسازید)\n/top جدول هفته',
  unavailable: 'امروز پازلی آماده نیست. کمی بعد دوباره /play را بزنید.',
  title: (dateFa: string) => `🧩 پازل روز دوزاری — ${dateFa}`,
  mistakes: 'فرصت‌ها:',
  selected: 'انتخاب شده:',
  pickFour: 'باید دقیقاً ۴ کارت انتخاب کنید',
  maxFour: 'حداکثر ۴ کارت',
  stale: 'صفحه به‌روز شد',
  gone: 'این بازی تمام شده؛ /play را بزنید',
  noteCorrect: (who: string) => `${who} یک دسته پیدا کرد 🎯`,
  noteOneAway: (who: string) => `${who} ثبت کرد: فقط یک کارت اشتباه بود 🔥`,
  noteWrong: (who: string) => `${who} ثبت کرد: اشتباه بود ❌`,
  noteDuplicate: (who: string) => `${who}: این چهارتایی را قبلاً امتحان کرده‌اید`,
  anon: 'یکی از اعضا',
  won: '🎉 آفرین! گروه شما پازل امروز را حل کرد.',
  lost: '😅 این بار پازل برد. جواب‌ها را ببینید:',
  summary: (mistakes: number, players: number) => `اشتباه‌ها: ${fa(mistakes)} · بازیکن‌ها: ${fa(players)}`,
  alreadyPlayed: (won: boolean) => `${won ? '✅ پازل امروز را حل کردید.' : '😅 پازل امروز تمام شد.'} پازل بعدی فردا.`,
  cta: 'پازل‌های بیشتر، دوئل ۱ به ۱ و ۲ به ۲، نمودار قیمت و کارت یادگار توی اپ منتظر شماست 👇',
  ctaButton: 'ادامه در بازی 🎮',
  shuffle: 'بُر زدن 🔀',
  submit: 'ثبت ✅',
  clear: 'پاک کردن',
  topTitle: '🏆 برترین‌های این هفته‌ی گروه',
  topEmpty: 'این هفته هنوز کسی در این گروه امتیازی نگرفته. /play را بزنید و اولین نفر باشید!',
  topRow: (rank: number, name: string, points: number, groups: number) => `${['🥇', '🥈', '🥉'][rank - 1] ?? `${fa(rank)}.`} ${name} — ${fa(points)} امتیاز (${fa(groups)} دسته)`,
  topFooter: 'امتیاز: هر دسته‌ی پیدا شده ۱۰ تا ۲۵ بسته به سختی. هفته از شنبه شروع می‌شود.',
} as const;

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
/** Latin digits to Persian ones. */
export function fa(n: number | string): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)]!);
}

/** Price mode (`/price`) texts. */
export const PRICE_TEXT = {
  unavailable: 'الان سؤال قیمتی آماده نیست. کمی بعد دوباره /price را بزنید.',
  busy: 'یک دور «قیمت‌شناسی» همین الان در جریان است 👆',
  limit: (max: number) => `امروز ${fa(max)} دور «قیمت‌شناسی» بازی کردید. فردا دوباره! توی اپ می‌توانید هر چقدر خواستید بازی کنید 👇`,
  question: (i: number, n: number, name: string, year: number, secs: number) => `💰 قیمت‌شناسی — سؤال ${fa(i)} از ${fa(n)}\n\nقیمت «${name}» در سال ${fa(year)} چقدر بود؟\n\nیکی را انتخاب کنید (${fa(secs)} ثانیه وقت دارید؛ هر نفر یک جواب):`,
  locked: 'جوابت ثبت شد ✅',
  already: 'جوابت قبلاً ثبت شده',
  closed: 'وقت این سؤال تمام شده',
  reveal: (i: number, n: number, name: string, year: number, price: string) => `💰 سؤال ${fa(i)} از ${fa(n)}: «${name}» در سال ${fa(year)}\n\n✅ قیمت درست: ${price}`,
  right: (who: string, pts: number) => `✅ ${who} (+${fa(pts)})`,
  wrong: (who: string) => `❌ ${who}`,
  nobody: 'کسی جواب نداد 😴',
  summaryTitle: '🏁 پایان دور قیمت‌شناسی',
  summaryRow: (rank: number, who: string, pts: number) => `${['🥇', '🥈', '🥉'][rank - 1] ?? `${fa(rank)}.`} ${who} — ${fa(pts)} امتیاز`,
  summaryNone: 'این بار کسی امتیاز نگرفت.',
} as const;

/** Table card (`/table CODE`) texts. */
export const TABLE_TEXT = {
  usage: 'کد میز را بعد از دستور بنویسید، مثلاً /table AB2CD\nمیز را در اپ می‌سازید (میز اختصاصی) و کدش را اینجا می‌گذارید تا بقیه‌ی گروه بپرند سر میز.',
  notFound: 'این میز پیدا نشد یا دیگر جا ندارد (پر، قفل، شروع‌شده یا بسته). یک میز تازه بسازید 🎲',
  slow: 'کمی صبر کنید، چند کارت میز پشت هم فرستاده شد.',
  card: (name: string, host: string, format: string, taken: number, seats: number, fee: number, code: string) =>
    `🎲 ${host} شما را به یک دوئل دعوت می‌کند!\n\nمیز «${name}» · ${format}\nصندلی‌ها: ${fa(taken)} از ${fa(seats)} پر است\nورودی: ${fee > 0 ? `${fa(fee)} سکه برای هر نفر` : 'رایگان'}\nکد میز: ${code}\n\nدکمه را بزنید تا مستقیم بروید سر میز 👇`,
  button: 'ورود به میز 🎮',
} as const;
