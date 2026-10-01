/** What the Bale bot says. Persian only; the bot is a separate surface from the app's `fa.ts`. */
export const BALE_TEXT = {
  help: 'سلام! من ربات «دوزاری» هستم.\nبرای وصل شدن به حسابت: در بازی بخش «اتصال به بله» را باز کن، کد را اینجا بفرست.\n\nدستورها:\n/status وضعیت اتصال\n/stop قطع اتصال',
  linked: 'وصل شدی ✅\nاز این به بعد خبرهای بازی را اینجا می‌گیری. برای قطع اتصال /stop را بفرست.',
  badCode: 'این کد درست نیست یا منقضی شده. در بازی یک کد تازه بگیر.',
  stopped: 'اتصال قطع شد. هر وقت خواستی دوباره کد بگیر و بفرست.',
  notLinked: 'هنوز به حسابی وصل نیستی.',
  statusLinked: 'به حسابت وصل هستی ✅',
  dailyReady: 'جایزه‌ی روزانه‌ات آماده است 🎁 بیا بگیرش!',
  matchWon: (reason: string) => `بازی را بردی 🏆 ${reason}`,
  matchLost: (reason: string) => `این بار باختی. ${reason}`,
  matchDraw: 'بازی مساوی شد.',
  reasons: { solved: 'همه‌ی گروه‌ها پیدا شد.', locked_out: 'خطاها تمام شد.', forfeit: 'نوبت‌ها از دست رفت.', abandon: 'حریف بازی را ترک کرد.' } as Record<string, string>,
} as const;
