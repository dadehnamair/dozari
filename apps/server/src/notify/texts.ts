/** What the Bale bot says. Persian only; the bot is a separate surface from the app's `fa.ts`. */
export const BALE_TEXT = {
  help: 'سلام! من ربات «دوزاری» هستم.\nبرای وصل شدن به حسابت: در بازی بخش «اتصال به بله» را باز کن، کد را اینجا بفرست.\n\nدستورها:\n/status وضعیت اتصال\n/stop قطع اتصال',
  welcome: 'سلام! به «دوزاری» خوش آمدی 👋\nبرای ساختن حساب و شروع بازی، دکمه‌ی «ارسال شماره‌ی من» را بزن.',
  signedUp: (existing: boolean) => (existing ? 'حسابت پیدا شد و به این چت وصل شد ✅ خبرهای بازی را اینجا می‌گیری.' : 'حسابت ساخته شد ✅ حالا می‌توانی بازی کنی و خبرهای بازی را همین‌جا بگیری.'),
  contactNotYours: 'این شماره‌ی خودت نیست. فقط با دکمه‌ی «ارسال شماره‌ی من» شماره‌ی خودت را بفرست (و شماره‌ی ایرانی باشد).',
  linked: 'وصل شدی ✅\nاز این به بعد خبرهای بازی را اینجا می‌گیری. برای قطع اتصال /stop را بفرست.',
  badCode: 'این کد درست نیست یا منقضی شده. در بازی یک کد تازه بگیر.',
  askContact: 'برای تأیید شماره‌ات، دکمه‌ی «ارسال شماره‌ی من» را بزن.',
  contactButton: 'ارسال شماره‌ی من 📱',
  phoneVerified: 'شماره‌ات تأیید شد ✅',
  phoneMismatch: 'این شماره با شماره‌ای که در بازی نوشته‌ای یکی نیست، یا مخاطب خودت نیست. شماره را در بازی درست کن و دوباره بفرست.',
  phoneConflict: 'این شماره قبلاً روی یک حساب دیگر ثبت شده بود. به بازی برگرد و انتخاب کن: امتیازهای همین حساب با این شماره بماند، یا امتیازهای قبلی بارگذاری شود.',
  paid: (coins: number) => `پرداخت انجام شد ✅ ${coins} سکه به حسابت اضافه شد. موفق باشی!`,
  paidItem: (title: string) => `پرداخت انجام شد ✅ «${title}» به حسابت اضافه شد. موفق باشی!`,
  phoneTaken: 'این شماره روی حساب دیگری تأیید شده است.',
  noPhonePending: 'اول در بازی شماره‌ی موبایلت را بنویس، بعد اینجا بفرست.',
  stopped: 'اتصال قطع شد. هر وقت خواستی دوباره کد بگیر و بفرست.',
  notLinked: 'هنوز به حسابی وصل نیستی.',
  statusLinked: 'به حسابت وصل هستی ✅',
  dailyReady: 'جایزه‌ی روزانه‌ات آماده است 🎁 بیا بگیرش!',
  birthdayWeek: (nickname: string, days: number) => `تولد ${nickname} ${days} روز دیگر است 🎂`,
  birthdayGift: (nickname: string, item: string) => `${nickname || 'یکی از دوستانت'} برای تولدت «${item}» هدیه فرستاد 🎁`,
  birthdayDay: (nickname: string) => `امروز تولد ${nickname} است 🎉 تبریک بگو!`,
  friendRequest: (nickname: string) => `${nickname} برایت درخواست دوستی فرستاد 🤝 در بازی جوابش را بده.`,
  tableInvite: (nickname: string) => `${nickname} تو را به یک میز دعوت کرد 🎲 بیا بازی کنیم!`,
  matchWon: (reason: string) => `بازی را بردی 🏆 ${reason}`,
  matchLost: (reason: string) => `این بار باختی. ${reason}`,
  matchDraw: 'بازی مساوی شد.',
  reasons: { solved: 'همه‌ی گروه‌ها پیدا شد.', locked_out: 'خطاها تمام شد.', forfeit: 'نوبت‌ها از دست رفت.', abandon: 'حریف بازی را ترک کرد.' } as Record<string, string>,
} as const;

/** Titles of the friend-birthday inbox messages. */
export const BIRTHDAY_TITLE = { week: 'تولد دوستت نزدیک است', day: 'امروز تولد یکی از دوستانت است', gift: 'یک هدیه‌ی تولد برایت رسید' } as const;
