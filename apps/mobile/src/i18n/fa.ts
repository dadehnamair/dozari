/**
 * All in-game UI strings live here (CLAUDE.md §Language) — never inline in components.
 * Group titles / taunts / product stories are DB content, not i18n, and don't belong here.
 */
export const fa = {
  home: {
    title: 'دوزاری',
    tagline: 'قیمت‌های قدیمی، حس نوستالژی',
    loading: 'در حال بارگذاری…',
    soloButton: 'تمرین تکی',
  },
  solo: {
    title: 'تمرین تکی',
    subtitle: 'چهارتا چهارتا دسته‌بندی کن',
    shuffle: 'قاطی کن',
    deselect: 'برداشتن انتخاب',
    submit: 'ثبت',
    newGame: 'بازی تازه',
    back: 'بازگشت',
    mistakes: 'اشتباه',
    won: 'آفرین! همه رو پیدا کردی',
    lost: 'این دفعه نشد؛ دسته‌ها رو ببین',
    revealed: 'نمایش داده شد',
    feedback: {
      correct: 'درسته!',
      oneAway: 'یکی مونده!',
      wrong: 'نه، اینطور نیست',
      duplicate: 'این رو قبلاً امتحان کردی',
    },
    chart: {
      title: 'قیمت‌ها در طول سال‌ها',
      noData: 'برای این گروه قیمتی ثبت نشده',
      linear: 'خطی',
      log: 'لگاریتمی',
      loadFailed: 'نمودار بارگذاری نشد',
    },
    groupTab: ['زرد', 'سبز', 'آبی', 'بنفش'],
    errors: {
      noPuzzles: 'هنوز پازلی آماده نیست',
      network: 'اتصال به سرور برقرار نشد',
      server: 'سرور خطا داد',
      badResponse: 'پاسخ سرور قابل‌فهم نبود',
      address: 'آدرس سرور',
      retry: 'تلاش دوباره',
    },
  },
} as const;
