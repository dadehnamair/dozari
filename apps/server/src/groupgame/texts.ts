/** What the bot says inside groups. Persian only (a bot surface, separate from the app's `fa.ts`). */
export const GROUP_TEXT = {
  welcome: 'سلام! من «دوزاری» هستم 🪙\nبازی حدس قیمت‌های قدیمی ایران: ۱۶ کارت، ۴ دسته‌ی چهارتایی که باید با هم پیدا کنید.\n\n/play پازل امروز گروه\n/price قیمت‌شناسی\n/question سؤال عمومی\n/table میز اختصاصی\n/top جدول هفته\n/help راهنما',
  help: 'راهنمای دوزاری 🧩\n۱۶ کارت روی صفحه است و ۴ دسته‌ی چهارتایی دارد که یک چیز مشترک دارند (مثلاً قیمتشان در یک سال).\nهر نفر جداگانه بازی می‌کند: کارت‌ها را بزنید، وقتی ۴ تا شد «ثبت» را بزنید. جواب هر کس فقط برای خودش نشان داده می‌شود (۴ اشتباه مجاز است). بعد از ۱۵ دقیقه نتیجه‌ی همه اعلام می‌شود.\nروزی یک پازل برای هر گروه.\n\n/play شروع پازل امروز\n/price پنج سؤال قیمت (روزی دو بار)\n/question پنج سؤال عمومی (روزی دو بار)\n/table CODE کارت میز اختصاصی (میز را در اپ بسازید)\n/top جدول هفته',
  unavailable: 'امروز پازلی آماده نیست. کمی بعد دوباره /play را بزنید.',
  title: (dateFa: string) => `🧩 پازل روز دوزاری — ${dateFa}`,
  howTo: (minutes: number) =>
    `هر نفر جداگانه بازی می‌کند 👇\n• ۴ کارت را که فکر می‌کنید یک دسته‌اند بزنید و «ثبت» را بزنید.\n• انتخاب و جواب هر کس فقط برای خودش نشان داده می‌شود؛ بقیه نمی‌بینند.\n• هر نفر ۴ اشتباه مجاز دارد.\n• ${fa(minutes)} دقیقه وقت دارید؛ بعد از آن جواب‌ها و نتیجه‌ی همه اعلام می‌شود.`,
  pickFour: 'باید دقیقاً ۴ کارت انتخاب کنید',
  maxFour: 'حداکثر ۴ کارت',
  gone: 'این بازی تمام شده؛ /play را بزنید',
  timeUp: 'وقت بازی تمام شد ⏱',
  alreadyDone: 'بازی تو تمام شده؛ منتظر نتیجه‌ی گروه باش',
  cardSolved: 'این کارت جزو دسته‌ای است که پیدا کردی',
  picked: (name: string, n: number, all: string) => `✅ ${name} (${fa(n)} از ۴)\nانتخاب تو: ${all}`,
  unpicked: (name: string, n: number) => `${name} برداشته شد (${fa(n)} از ۴)`,
  cleared: 'انتخاب‌هایت پاک شد',
  shuffleGone: 'بُر زدن دیگر نیست؛ همه روی یک چیدمان بازی می‌کنند',
  mineCorrect: (title: string, found: number) => `🎯 درست بود! «${title}»\nتا حالا ${fa(found)} دسته از ۴ را پیدا کرده‌ای`,
  mineOneAway: (left: number) => `🔥 فقط یک کارت اشتباه بود! ${fa(left)} فرصت مانده`,
  mineWrong: (left: number) => `❌ اشتباه بود. ${fa(left)} فرصت مانده`,
  mineDuplicate: 'این چهارتایی را قبلاً امتحان کرده‌ای',
  mineWon: (mistakes: number) => `🎉 هر ۴ دسته را پیدا کردی! (${fa(mistakes)} اشتباه)\nمنتظر نتیجه‌ی گروه باش`,
  mineLost: (found: number) => `😅 فرصت‌هایت تمام شد. ${fa(found)} دسته پیدا کردی؛ منتظر نتیجه‌ی گروه باش`,
  remind: (minutes: number, players: number) => `⏳ ${fa(minutes)} دقیقه به پایان پازل مانده!${players > 0 ? ` تا حالا ${fa(players)} نفر بازی کرده‌اند.` : ' هنوز کسی شروع نکرده، شما اول باشید!'}\nپازل همان پیام بالاست؛ جواب‌ها فقط برای خودتان نشان داده می‌شود.`,
  closedBoard: (dateFa: string) => `🧩 پازل روز دوزاری — ${dateFa}\n\n⏱ وقت تمام شد. نتیجه در پیام بعدی است 👇`,
  resultsTitle: (dateFa: string) => `🏁 نتیجه‌ی پازل روز دوزاری — ${dateFa}`,
  resultsHeader: 'نتیجه‌ی هر نفر:',
  resultsNobody: 'این بار کسی بازی نکرد 😴',
  resultRow: (rank: number, name: string, groups: number, mistakes: number) => `${['🥇', '🥈', '🥉'][rank - 1] ?? `${fa(rank)}.`} ${name} — ${fa(groups)} دسته از ۴ · ${fa(mistakes)} اشتباه`,
  resultsMore: (n: number) => `و ${fa(n)} نفر دیگر`,
  anon: 'یکی از اعضا',
  alreadyPlayed: (won: boolean) => `${won ? '✅ پازل امروز را حل کردید.' : '😅 پازل امروز تمام شد.'} پازل بعدی فردا.`,
  cta: '🎁 امتیازت توی حساب اصلی‌ات هم می‌نشیند: XP برای بالا رفتن لول و سکه. با دکمه‌ی زیر وارد بازی شو تا حسابت وصل بشه (تلگرام و بله، روزی تا سقف مشخص).\nپازل‌های بیشتر، دوئل ۱ به ۱ و ۲ به ۲، نمودار قیمت و کارت یادگار هم توی اپ منتظر شماست 👇',
  ctaButton: 'ادامه در بازی 🎮',
  submit: 'ثبت ✅',
  clear: 'پاک کردن',
  topTitle: '🏆 برترین‌های این هفته‌ی گروه',
  topEmpty: 'این هفته هنوز کسی در این گروه امتیازی نگرفته. /play را بزنید و اولین نفر باشید!',
  topRow: (rank: number, name: string, points: number, groups: number) => `${['🥇', '🥈', '🥉'][rank - 1] ?? `${fa(rank)}.`} ${name} — ${fa(points)} امتیاز (${fa(groups)} دسته)`,
  topFooter: 'امتیاز: هر دسته‌ی پیدا شده ۱۰ تا ۲۵ بسته به سختی. هفته از شنبه شروع می‌شود.\nاگر حساب بازی‌ات وصل است، امتیازها XP و سکه هم می‌شوند.',
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
  question: (i: number, n: number, name: string, year: number, secs: number, answered: number) =>
    `💰 قیمت‌شناسی — سؤال ${fa(i)} از ${fa(n)}\n\n❓ قیمت «${name}» در سال ${fa(year)} چقدر بود؟\n\n👇 یکی از چهار قیمت را بزنید\n• هر نفر فقط یک جواب می‌تواند بدهد و بعد از زدن عوض نمی‌شود.\n• جواب درست و برنده‌ها بعد از پایان وقت اعلام می‌شود.\n\n⏳ ${fa(secs)} ثانیه مانده · ${answered > 0 ? `${fa(answered)} نفر جواب داده‌اند` : 'هنوز کسی جواب نداده'}`,
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

/** General-question mode (`/question`) texts. */
export const QUESTION_TEXT = {
  unavailable: 'الان سؤالی آماده نیست. کمی بعد دوباره /question را بزنید.',
  busy: 'یک دور «سؤال عمومی» همین الان در جریان است 👆',
  limit: (max: number) => `امروز ${fa(max)} دور «سؤال عمومی» بازی کردید. فردا دوباره! توی اپ می‌توانید هر چقدر خواستید بازی کنید 👇`,
  question: (i: number, n: number, text: string, secs: number, answered: number) =>
    `🧠 سؤال عمومی — ${fa(i)} از ${fa(n)}\n\n❓ ${text}\n\n👇 یکی از چهار گزینه را بزنید\n• هر نفر فقط یک جواب می‌تواند بدهد و بعد از زدن عوض نمی‌شود.\n• جواب درست و برنده‌ها بعد از پایان وقت اعلام می‌شود.\n\n⏳ ${fa(secs)} ثانیه مانده · ${answered > 0 ? `${fa(answered)} نفر جواب داده‌اند` : 'هنوز کسی جواب نداده'}`,
  locked: 'جوابت ثبت شد ✅',
  already: 'جوابت قبلاً ثبت شده',
  closed: 'وقت این سؤال تمام شده',
  reveal: (i: number, n: number, text: string, right: string, why: string) => `🧠 سؤال ${fa(i)} از ${fa(n)}: ${text}\n\n✅ جواب درست: ${right}${why ? `\n💡 ${why}` : ''}`,
  right: (who: string, pts: number) => `✅ ${who} (+${fa(pts)})`,
  wrong: (who: string) => `❌ ${who}`,
  nobody: 'کسی جواب نداد 😴',
  summaryTitle: '🏁 پایان دور سؤال عمومی',
  summaryRow: (rank: number, who: string, pts: number) => `${['🥇', '🥈', '🥉'][rank - 1] ?? `${fa(rank)}.`} ${who} — ${fa(pts)} امتیاز`,
  summaryNone: 'این بار کسی امتیاز نگرفت.',
} as const;
