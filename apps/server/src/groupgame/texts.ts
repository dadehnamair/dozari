/** What the bot says inside groups. Persian only (a bot surface, separate from the app's `fa.ts`). */
export const GROUP_TEXT = {
  welcome: 'سلام! من «دوزاری» هستم 🪙\nبازی حدس قیمت‌های قدیمی ایران: ۱۶ کارت، ۴ دسته‌ی چهارتایی که باید با هم پیدا کنید.\n\n/play پازل امروز گروه\n/help راهنما',
  help: 'راهنمای دوزاری 🧩\n۱۶ کارت روی صفحه است و ۴ دسته‌ی چهارتایی دارد که یک چیز مشترک دارند (مثلاً قیمتشان در یک سال).\nکارت‌ها را بزنید تا ✅ شوند، وقتی ۴ تا شد «ثبت» را بزنید. همه‌ی اعضا روی یک صفحه بازی می‌کنند و ۴ اشتباه مجاز است.\nروزی یک پازل برای هر گروه.\n\n/play شروع پازل امروز',
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
} as const;

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
/** Latin digits to Persian ones. */
export function fa(n: number | string): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)]!);
}
