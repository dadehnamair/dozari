import { LEVEL_REWARD_BASE_COINS, LEVEL_REWARD_EVERY } from './progression.js';
import {
  AVATAR_CHANGE_MIN_LEVEL,
  AVATAR_UNLOCK_GAMES,
  FIRST_BLOOD_BONUS,
  GROUP_POINTS,
  MATCH_MAX_MISTAKES,
  MAX_CONSECUTIVE_TIMEOUTS,
  NICKNAME_CHANGE_MIN_LEVEL,
  NICKNAME_UNLOCK_GAMES,
  PRICE_GUESS_LOSER_BONUS_PER_ROUND,
  PRICE_GUESS_MIN_POINTS,
  PRICE_GUESS_ROUND_POINTS,
  PRICE_GUESS_STAIRCASE,
  PRICE_ONLY_MAX_ROUNDS,
  PRICE_ONLY_ROUNDS,
  SOLO_MAX_MISTAKES,
  TEAM_MATCH_BOARDS,
  TURN_SECONDS,
} from './game.js';
import { BROKE_RESCUE_TARGET, DAILY_FREE_MATCHES, SIGNUP_BONUS, ENTRY_FEE_BASE, FREE_MATCH_PAYOUT_PERCENT, HOUSE_CUT_PERCENT, LOSS_CONSOLATION, LOSS_CONSOLATION_DAILY_CAP, DAILY_REWARD_COOLDOWN_HOURS, DAILY_REWARD_STREAK_WINDOW_HOURS, DUEL_MIN_LEVEL, HINT_MAX_PER_GAME, HINT_MIN_LEVEL, HINT_PRICES, HINT_REPEAT_PERCENT, DAILY_PUZZLE_REWARD, DAILY_PUZZLE_STREAK_MAX_DAYS, DAILY_PUZZLE_STREAK_STEP, DAILY_PUZZLE_REPEAT_DAYS, STAKE_TIERS, GIFT_FEE_PERCENT, DAILY_SHOP_SLOTS, KEEPSAKE_DROP_CHANCE } from './economy.js';
import { CHART_GAP_BREAK_YEARS, CHART_MIN_YEAR } from './chart.js';
import { INVITE_INVITEE_BONUS, INVITE_INVITER_REWARD, INVITE_MAX_USES, INVITE_MIN_LEVEL, INVITE_REWARD_AFTER_GAMES } from './invite.js';
import { LOAN_DUE_DAYS, LOAN_MAX_OPEN, TRANSFER_MAX_AMOUNT, TRANSFER_MIN_AMOUNT, TRANSFER_MIN_FRIEND_DAYS, TRANSFER_MIN_LEVEL, TRANSFER_WEEKLY_CAP } from './transfers.js';
import { TABLE_IDLE_MINUTES } from '../tables/code.js';
import { CHAT_MAX_LEN } from './chat.js';
import { SWITCHABLE_TRACKS, TRACK_FEATURES, TRACK_FEATURE_LABEL_FA, trackFeatureKey } from './ageTracks.js';
import { SKILL_MIN_GAMES, SKILL_PRO_GAMES, SKILL_PRO_WIN_PERCENT } from './progression.js';
import { LEVEL_MAX, NICKNAME_MAX_LEN, NICKNAME_MIN_LEN, XP_CURVE_BASE, XP_DUEL_BASE, XP_SOLO_BASE, XP_WIN_BONUS } from './progression.js';

/**
 * Every tunable the admin panel can change. The defaults come from the constants in `config/*.ts` (CLAUDE.md rule 9);
 * an override is a row in `app_settings`. Values are integers or short lists of integers (stored as "1,2,3,4", no JSON).
 */
export const SETTING_GROUPS = ['app', 'gameplay', 'scoring', 'profile', 'economy', 'chart', 'bot', 'notify', 'review', 'seo'] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number];

export interface SettingDef {
  key: string;
  group: SettingGroup;
  label: string;
  hint?: string;
  /** `text` is a short string: `max` is its length limit, `min` is ignored. */
  kind: 'int' | 'bool' | 'intList' | 'text';
  min: number;
  max: number;
  /** For lists: exact length. */
  length?: number;
  default: number | readonly number[] | string;
  unit?: string;
}

/** One on/off switch per kid/teen track and feature (`track.kid.chat` …): a whole track can lose a feature without touching the others. */
const TRACK_FEATURE_DEFS: SettingDef[] = SWITCHABLE_TRACKS.flatMap((track) =>
  TRACK_FEATURES.map((feature): SettingDef => ({
    key: trackFeatureKey(track, feature),
    group: 'app',
    label: `${track === 'kid' ? 'کودک' : 'نوجوان'}: ${TRACK_FEATURE_LABEL_FA[feature]}`,
    hint: 'کلید ایمنی رده‌ی سنی؛ خاموش = این رده این بخش را نمی‌بیند (فقط وقتی «رده‌های سنی» روشن است)',
    kind: 'bool',
    min: 0,
    max: 1,
    default: 1,
  })),
);

export const SETTING_DEFS: readonly SettingDef[] = [
  { key: 'app.maintenance_on', group: 'app', label: 'حالت تعمیر (بازیکن‌ها فقط پیام تعمیر را می‌بینند)', kind: 'bool', min: 0, max: 1, default: 0 },
  { key: 'app.maintenance_message', group: 'app', label: 'پیام حالت تعمیر', kind: 'text', min: 0, max: 300, default: 'بازی برای چند دقیقه در دست تعمیر است. به‌زودی برمی‌گردیم.' },
  { key: 'app.min_build', group: 'app', label: 'کمترین نسخه‌ی مجاز اپ (شماره‌ی بیلد)', hint: 'نسخه‌های قدیمی‌تر باید به‌روزرسانی کنند؛ ۰ یعنی همه مجازند', kind: 'int', min: 0, max: 99999, default: 0 },
  { key: 'app.update_url', group: 'app', label: 'لینک به‌روزرسانی', hint: 'صفحه‌ی اپ در بازار / مایکت / بله', kind: 'text', min: 0, max: 300, default: '' },
  { key: 'feature.priceonly', group: 'app', label: 'حالت فقط حدس قیمت روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'priceonly.rounds', group: 'scoring', label: 'تعداد دور در بازی «فقط حدس قیمت»', kind: 'int', min: 1, max: PRICE_ONLY_MAX_ROUNDS, default: PRICE_ONLY_ROUNDS },
  { key: 'feature.lookup', group: 'app', label: 'استعلام قیمت روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'feature.duel', group: 'app', label: 'بازی دونفره‌ی زنده روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'feature.friends', group: 'app', label: 'دوستان و پروفایل بازیکن‌ها روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'feature.age_tracks', group: 'app', label: 'رده‌های سنی (کودک، نوجوان، بزرگسال) روشن باشد', hint: 'خاموش = همه بزرگسال‌اند و صفحه‌ی انتخاب رده دیده نمی‌شود؛ بعد از آماده شدن محتوای کودک روشنش کن', kind: 'bool', min: 0, max: 1, default: 0 },
  { key: 'feature.inbox', group: 'app', label: 'صندوق پیام داخل اپ روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'feature.bale', group: 'app', label: 'اتصال به بله روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'review.enabled', group: 'review', label: 'درخواست نظر در فروشگاه روشن باشد', hint: 'پیش‌فرض خاموش؛ بعد از پر کردن لینک فروشگاه‌ها روشنش کن', kind: 'bool', min: 0, max: 1, default: 0 },
  { key: 'ugc.daily_limit', group: 'review', label: 'پیشنهاد و گزارش قیمت در روز برای هر بازیکن', kind: 'int', min: 1, max: 200, default: 10 },
  { key: 'ugc.voter_min_games', group: 'review', label: 'حداقل بازی تمام‌شده برای رأی دادن به پیشنهادها', kind: 'int', min: 0, max: 500, default: 10 },
  { key: 'ugc.approve_score', group: 'review', label: 'امتیاز رأی برای رفتن به صف مدیر', kind: 'int', min: 1, max: 100, default: 5 },
  { key: 'ugc.reject_score', group: 'review', label: 'امتیاز منفی برای ردشدن خودکار', kind: 'int', min: 1, max: 100, default: 3 },
  { key: 'ugc.reward_coins', group: 'review', label: 'سکه‌ی پاداش پیشنهاد تأییدشده', hint: '۰ = بدون پاداش', kind: 'int', min: 0, max: 10_000, default: 30, unit: 'سکه' },
  { key: 'report.daily_limit', group: 'review', label: 'گزارش بازیکن در روز برای هر بازیکن', kind: 'int', min: 1, max: 100, default: 10 },
  { key: 'review.after_days', group: 'review', label: 'اولین بار بعد از چند روز از نصب', kind: 'int', min: 0, max: 365, default: 3, unit: 'روز' },
  { key: 'review.after_games', group: 'review', label: 'و بعد از چند بازی تمام‌شده', kind: 'int', min: 0, max: 500, default: 3 },
  { key: 'review.repeat_days', group: 'review', label: 'هر چند روز یک بار دوباره بپرسد (اگر «بعداً» زد)', kind: 'int', min: 1, max: 365, default: 30, unit: 'روز' },
  { key: 'review.max_prompts', group: 'review', label: 'حداکثر چند بار از هر بازیکن بپرسد', kind: 'int', min: 1, max: 20, default: 3 },
  { key: 'review.myket', group: 'review', label: 'برای نسخه‌ی مایکت روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'review.bazaar', group: 'review', label: 'برای نسخه‌ی بازار روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'review.bale', group: 'review', label: 'برای نسخه‌ی بله روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'review.package_id', group: 'review', label: 'شناسه‌ی بسته‌ی اپ (package)', kind: 'text', min: 0, max: 100, default: 'ir.dozari.app' },
  { key: 'review.url_myket', group: 'review', label: 'لینک صفحه‌ی مایکت', hint: 'خالی = از روی شناسه‌ی بسته ساخته می‌شود (myket.ir/app/…)', kind: 'text', min: 0, max: 300, default: '' },
  { key: 'review.url_bazaar', group: 'review', label: 'لینک صفحه‌ی بازار', hint: 'خالی = از روی شناسه‌ی بسته ساخته می‌شود (cafebazaar.ir/app/…)', kind: 'text', min: 0, max: 300, default: '' },
  { key: 'review.url_bale', group: 'review', label: 'لینک صفحه‌ی اپ در بله', hint: 'باید خودت پر کنی؛ حدس نمی‌زنیم', kind: 'text', min: 0, max: 300, default: '' },
  { key: 'review.message', group: 'review', label: 'متن درخواست', kind: 'text', min: 0, max: 200, default: 'اگه از دوزاری خوشت اومده، یه نظر برامون بذار ❤️' },
  { key: 'game.solo_max_mistakes', group: 'gameplay', label: 'اشتباه مجاز در بازی تکی', kind: 'int', min: 1, max: 10, default: SOLO_MAX_MISTAKES },
  { key: 'game.match_max_mistakes', group: 'gameplay', label: 'اشتباه مجاز هر بازیکن در دوئل', kind: 'int', min: 1, max: 10, default: MATCH_MAX_MISTAKES },
  { key: 'game.turn_seconds', group: 'gameplay', label: 'زمان هر نوبت', kind: 'int', min: 10, max: 180, default: TURN_SECONDS, unit: 'ثانیه' },
  { key: 'game.max_consecutive_timeouts', group: 'gameplay', label: 'تایم‌اوت پیاپی تا باخت', hint: 'بعد از این تعداد تایم‌اوت پشت‌سرهم، بازیکن می‌بازد', kind: 'int', min: 1, max: 5, default: MAX_CONSECUTIVE_TIMEOUTS },
  { key: 'score.group_points', group: 'scoring', label: 'امتیاز حل هر دسته (زرد تا بنفش)', hint: 'چهار عدد با ویرگول', kind: 'intList', length: 4, min: 0, max: 20, default: GROUP_POINTS },
  { key: 'score.first_blood_bonus', group: 'scoring', label: 'امتیاز اضافه‌ی اولین دسته', kind: 'int', min: 0, max: 10, default: FIRST_BLOOD_BONUS },
  { key: 'score.guess_round_points', group: 'scoring', label: 'امتیاز بردن یک دور حدس قیمت (دوئل)', kind: 'int', min: 0, max: 10, default: PRICE_GUESS_ROUND_POINTS },
  { key: 'score.guess_loser_bonus', group: 'scoring', label: 'امتیاز دلداری به بازنده‌ی ماندگار', hint: 'برای هر دور حدس قیمتی که برده', kind: 'int', min: 0, max: 10, default: PRICE_GUESS_LOSER_BONUS_PER_ROUND },
  { key: 'score.staircase_error_pct', group: 'scoring', label: 'پله‌های خطا در حدس قیمت (درصد)', hint: 'چهار عدد صعودی؛ خطای کمتر از هر پله، امتیاز همان پله', kind: 'intList', length: 4, min: 1, max: 100, default: PRICE_GUESS_STAIRCASE.map((s) => s.maxErrorPct) },
  { key: 'score.staircase_points', group: 'scoring', label: 'امتیاز پله‌های حدس قیمت', hint: 'چهار عدد نزولی، هم‌ترتیب با پله‌ها', kind: 'intList', length: 4, min: 1, max: 20, default: PRICE_GUESS_STAIRCASE.map((s) => s.points) },
  { key: 'score.guess_min_points', group: 'scoring', label: 'کمترین امتیاز حدس قیمت', kind: 'int', min: 0, max: 10, default: PRICE_GUESS_MIN_POINTS },
  { key: 'profile.avatar_unlock_games', group: 'profile', label: 'بازی لازم برای انتخاب رایگان آواتار', kind: 'int', min: 0, max: 100, default: AVATAR_UNLOCK_GAMES, unit: 'بازی' },
  { key: 'profile.nickname_unlock_games', group: 'profile', label: 'بازی لازم برای انتخاب رایگان اسم', kind: 'int', min: 0, max: 200, default: NICKNAME_UNLOCK_GAMES, unit: 'بازی' },
  { key: 'profile.avatar_change_min_level', group: 'profile', label: 'کمترین لول برای تغییر آواتار (خرید)', kind: 'int', min: 1, max: 100, default: AVATAR_CHANGE_MIN_LEVEL },
  { key: 'profile.nickname_change_min_level', group: 'profile', label: 'کمترین لول برای تغییر اسم (خرید)', kind: 'int', min: 1, max: 100, default: NICKNAME_CHANGE_MIN_LEVEL },
  { key: 'xp.solo_base', group: 'profile', label: 'تجربه (XP) برای هر بازی تکی تمام‌شده', kind: 'int', min: 0, max: 1000, default: XP_SOLO_BASE },
  { key: 'xp.duel_base', group: 'profile', label: 'تجربه (XP) برای هر دوئل تمام‌شده', kind: 'int', min: 0, max: 1000, default: XP_DUEL_BASE },
  { key: 'xp.win_bonus', group: 'profile', label: 'تجربه‌ی اضافه برای برد', kind: 'int', min: 0, max: 1000, default: XP_WIN_BONUS },
  { key: 'xp.curve_base', group: 'profile', label: 'ضریب منحنی لول', hint: 'رسیدن به لول n+1 یعنی ضریب × n² تجربه؛ ضریب بزرگ‌تر = لول‌گرفتن سخت‌تر', kind: 'int', min: 1, max: 5000, default: XP_CURVE_BASE },
  { key: 'xp.level_max', group: 'profile', label: 'بالاترین لول', kind: 'int', min: 2, max: 500, default: LEVEL_MAX },
  { key: 'nickname.min_len', group: 'profile', label: 'کمترین طول اسم', kind: 'int', min: 1, max: 30, default: NICKNAME_MIN_LEN, unit: 'حرف' },
  { key: 'nickname.max_len', group: 'profile', label: 'بیشترین طول اسم', kind: 'int', min: 2, max: 60, default: NICKNAME_MAX_LEN, unit: 'حرف' },
  { key: 'nickname.allow_digits', group: 'profile', label: 'عدد در اسم مجاز باشد', kind: 'bool', min: 0, max: 1, default: 0 },
  { key: 'nickname.allow_latin', group: 'profile', label: 'حرف انگلیسی در اسم مجاز باشد', kind: 'bool', min: 0, max: 1, default: 0 },
  { key: 'nickname.allow_persian', group: 'profile', label: 'حرف فارسی در اسم مجاز باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'economy.daily_cooldown_hours', group: 'economy', label: 'فاصله‌ی دریافت جایزه‌ی روزانه', kind: 'int', min: 1, max: 72, default: DAILY_REWARD_COOLDOWN_HOURS, unit: 'ساعت' },
  { key: 'economy.daily_streak_window_hours', group: 'economy', label: 'مهلت ادامه‌ی زنجیره‌ی جایزه', hint: 'دریافت بعدی تا این مدت بعد از قبلی، زنجیره را ادامه می‌دهد؛ دیرتر از آن از روز اول شروع می‌شود', kind: 'int', min: 2, max: 168, default: DAILY_REWARD_STREAK_WINDOW_HOURS, unit: 'ساعت' },
  { key: 'limit.solo_per_day', group: 'gameplay', label: 'سقف بازی تکی در روز برای هر بازیکن', hint: '۰ یعنی بدون سقف؛ ساعت صفر به وقت تهران صفر می‌شود', kind: 'int', min: 0, max: 1000, default: 0 },
  { key: 'limit.duel_per_day', group: 'gameplay', label: 'سقف بازی دونفره‌ی زنده در روز برای هر بازیکن', hint: '۰ یعنی بدون سقف', kind: 'int', min: 0, max: 1000, default: 0 },
  { key: 'duel.entry_fee', group: 'economy', label: 'ورودی بازی دونفره‌ی زنده (سکه برای هر نفر)', hint: 'جمع دو ورودی می‌شود جایزه‌ی برنده', kind: 'int', min: 0, max: 10000, default: ENTRY_FEE_BASE, unit: 'سکه' },
  { key: 'duel.silver_fee', group: 'economy', label: 'ورودی میز نقره‌ای (سکه برای هر نفر)', hint: '۰ = میز نقره‌ای خاموش. فقط صف دوئل؛ بازی رایگان روزانه فقط روی میز برنزی است', kind: 'int', min: 0, max: 100000, default: STAKE_TIERS[1]!.fee, unit: 'سکه' },
  { key: 'duel.silver_min_level', group: 'economy', label: 'حداقل لول برای میز نقره‌ای', kind: 'int', min: 1, max: 200, default: STAKE_TIERS[1]!.minLevel },
  { key: 'duel.gold_fee', group: 'economy', label: 'ورودی میز طلایی (سکه برای هر نفر)', hint: '۰ = میز طلایی خاموش', kind: 'int', min: 0, max: 100000, default: STAKE_TIERS[2]!.fee, unit: 'سکه' },
  { key: 'duel.gold_min_level', group: 'economy', label: 'حداقل لول برای میز طلایی', kind: 'int', min: 1, max: 200, default: STAKE_TIERS[2]!.minLevel },
  { key: 'duel.price_wager', group: 'economy', label: 'شرط هر دور حدس قیمت در دوئل (سکه برای هر نفر)', hint: '۰ = بدون شرط. برنده‌ی هر دور جمع دو شرط منهای سهم خانه را می‌گیرد، مساوی یعنی پس‌گرفتن هر شرط منهای سهم خانه. کسی که سکه‌ی کافی ندارد آن دور را بدون شرط و بدون حدس می‌گذراند. فقط وقتی «دور حدس قیمت» روشن است اثر دارد.', kind: 'int', min: 0, max: 50, default: 0 },
  { key: 'duel.house_cut_percent', group: 'economy', label: 'سهم خانه از جایزه‌ی هر بازی', kind: 'int', min: 0, max: 90, default: HOUSE_CUT_PERCENT, unit: '٪' },
  { key: 'economy.signup_bonus', group: 'economy', label: 'سکه‌ی هدیه‌ی ثبت‌نام (یک بار برای هر حساب تازه)', hint: '۰ = بدون هدیه؛ فقط روی حساب‌های تازه اثر دارد', kind: 'int', min: 0, max: 100_000, default: SIGNUP_BONUS, unit: 'سکه' },
  { key: 'duel.free_per_day', group: 'economy', label: 'بازی رایگان دونفره در روز', kind: 'int', min: 0, max: 100, default: DAILY_FREE_MATCHES },
  { key: 'duel.free_payout_percent', group: 'economy', label: 'جایزه‌ی بردِ بازی رایگان (درصد جایزه‌ی عادی)', kind: 'int', min: 0, max: 100, default: FREE_MATCH_PAYOUT_PERCENT, unit: '٪' },
  { key: 'duel.loss_consolation', group: 'economy', label: 'دلداری باخت (سکه)', kind: 'int', min: 0, max: 1000, default: LOSS_CONSOLATION, unit: 'سکه' },
  { key: 'duel.consolation_cap', group: 'economy', label: 'سقف دلداری باخت در روز برای هر بازیکن', kind: 'int', min: 0, max: 10000, default: LOSS_CONSOLATION_DAILY_CAP, unit: 'سکه' },
  { key: 'duel.rescue_target', group: 'economy', label: 'نجات از بی‌سکه‌ای: رساندن موجودی به', hint: 'روزی یک بار، وقتی سکه برای ورودی نیست و بازی رایگان هم تمام شده', kind: 'int', min: 0, max: 10000, default: BROKE_RESCUE_TARGET, unit: 'سکه' },
  { key: 'profiletask.coins_gender', group: 'economy', label: 'جایزه‌ی تکمیل پروفایل: انتخاب جنسیت', hint: 'یک بار برای هر بازیکن؛ ۰ = بدون جایزه', kind: 'int', min: 0, max: 10000, default: 10, unit: 'سکه' },
  { key: 'profiletask.coins_city', group: 'economy', label: 'جایزه‌ی تکمیل پروفایل: انتخاب شهر', hint: 'یک بار برای هر بازیکن؛ ۰ = بدون جایزه', kind: 'int', min: 0, max: 10000, default: 20, unit: 'سکه' },
  { key: 'profiletask.coins_phone', group: 'economy', label: 'جایزه‌ی تکمیل پروفایل: تأیید شماره‌ی موبایل', hint: 'یک بار برای هر بازیکن؛ ۰ = بدون جایزه', kind: 'int', min: 0, max: 10000, default: 50, unit: 'سکه' },
  { key: 'profiletask.coins_bale', group: 'economy', label: 'جایزه‌ی تکمیل پروفایل: اتصال به بله', hint: 'یک بار برای هر بازیکن؛ ۰ = بدون جایزه', kind: 'int', min: 0, max: 10000, default: 30, unit: 'سکه' },
  { key: 'profiletask.coins_first_win', group: 'economy', label: 'ماموریت: اولین برد', hint: 'یک بار برای هر بازیکن؛ ۰ = بدون جایزه', kind: 'int', min: 0, max: 10000, default: 25, unit: 'سکه' },
  { key: 'profiletask.coins_invite_friend', group: 'economy', label: 'ماموریت: دعوت یک دوست (که بازی کند)', hint: 'یک بار برای هر بازیکن؛ ۰ = بدون جایزه', kind: 'int', min: 0, max: 10000, default: 100, unit: 'سکه' },
  { key: 'profiletask.coins_follow_instagram', group: 'economy', label: 'ماموریت: دنبال‌کردن اینستاگرام', hint: 'قابل بررسی نیست (ادعای خود بازیکن)، پس کم بگذار. ۰ = بدون جایزه', kind: 'int', min: 0, max: 10000, default: 15, unit: 'سکه' },
  { key: 'profiletask.coins_follow_channel', group: 'economy', label: 'ماموریت: عضویت در کانال', hint: 'قابل بررسی نیست (ادعای خود بازیکن)، پس کم بگذار. ۰ = بدون جایزه', kind: 'int', min: 0, max: 10000, default: 15, unit: 'سکه' },
  { key: 'profiletask.coins_rate_app', group: 'economy', label: 'ماموریت: نظر دادن در فروشگاه', hint: 'قابل بررسی نیست (ادعای خود بازیکن). ۰ = بدون جایزه', kind: 'int', min: 0, max: 10000, default: 40, unit: 'سکه' },
  { key: 'link.instagram', group: 'app', label: 'لینک صفحه‌ی اینستاگرام', hint: 'خالی = ماموریت دنبال‌کردن اینستاگرام نمایش داده نمی‌شود', kind: 'text', min: 0, max: 200, default: '' },
  { key: 'sponsor.cta_title', group: 'app', label: 'دعوت به اسپانسری: عنوان', kind: 'text', min: 0, max: 60, default: 'می‌خوای اسپانسر بشی؟' },
  { key: 'sponsor.cta_body', group: 'app', label: 'دعوت به اسپانسری: متن', kind: 'text', min: 0, max: 300, default: 'اسم و بنر کسب‌وکارت بالای تورنومنت‌های دوزاری می‌ماند و جلوی چشم هزاران بازیکن قرار می‌گیرد.' },
  { key: 'sponsor.contact_url', group: 'app', label: 'دعوت به اسپانسری: لینک تماس', hint: 'لینک https یا mailto:. خالی = کارت «اسپانسر شو» نمایش داده نمی‌شود', kind: 'text', min: 0, max: 300, default: '' },
  { key: 'domain.app', group: 'app', label: 'دامنه‌ی بازی (وب)', hint: 'فقط نام دامنه، مثل mrbots.ir', kind: 'text', min: 0, max: 100, default: 'mrbots.ir' },
  { key: 'domain.api', group: 'app', label: 'دامنه‌ی سرور (API)', kind: 'text', min: 0, max: 100, default: 'api.mrbots.ir' },
  { key: 'domain.landing', group: 'app', label: 'دامنه‌ی سایت معرفی و بلاگ', kind: 'text', min: 0, max: 100, default: 'mrdozari.ir' },
  { key: 'domain.short', group: 'app', label: 'دامنه‌ی لینک کوتاه', hint: 'درخواست‌هایی که با این دامنه برسند به لینک کوتاه تبدیل می‌شوند', kind: 'text', min: 0, max: 100, default: '2oi.ir' },
  { key: 'landing.site_name', group: 'seo', label: 'نام سایت معرفی', kind: 'text', min: 1, max: 60, default: 'دوزاری' },
  { key: 'landing.tagline', group: 'seo', label: 'شعار سایت معرفی', kind: 'text', min: 0, max: 120, default: 'بازی نوستالژی قیمت‌ها' },
  { key: 'landing.hero_title', group: 'seo', label: 'تیتر اصلی صفحه‌ی اول سایت معرفی', kind: 'text', min: 0, max: 120, default: 'قیمت‌های قدیمی را حدس بزن، با دوستانت بازی کن' },
  { key: 'landing.hero_text', group: 'seo', label: 'متن زیر تیتر صفحه‌ی اول', hint: 'جمله‌ی اول باید مستقیم بگوید بازی چیست', kind: 'text', min: 0, max: 400, default: 'دوزاری یک بازی آنلاین فارسی است: ۱۶ کالا را در ۴ دسته‌ی چهارتایی بر اساس قیمت‌های واقعی سال‌های گذشته ایران گروه‌بندی می‌کنی، تکی یا زنده با دوستانت.' },
  { key: 'landing.contact_email', group: 'seo', label: 'ایمیل تماس سایت معرفی', hint: 'خالی = نشان داده نمی‌شود', kind: 'text', min: 0, max: 120, default: '' },
  { key: 'landing.seo_title', group: 'seo', label: 'عنوان گوگل صفحه‌ی اول (title)', hint: 'حدود ۶۰ نویسه؛ خالی = از نام و شعار ساخته می‌شود', kind: 'text', min: 0, max: 90, default: '' },
  { key: 'landing.seo_description', group: 'seo', label: 'توضیح گوگل صفحه‌ی اول (description)', hint: 'حدود ۱۵۵ نویسه؛ خالی = از متن زیر تیتر ساخته می‌شود', kind: 'text', min: 0, max: 220, default: '' },
  { key: 'landing.keywords', group: 'seo', label: 'کلیدواژه‌های سایت', hint: 'با ویرگول جدا کن؛ در داده‌ی ساخت‌یافته‌ی سایت (JSON-LD) می‌آید، نه متای keywords', kind: 'text', min: 0, max: 300, default: '' },
  { key: 'landing.og_image', group: 'seo', label: 'تصویر اشتراک‌گذاری (og:image)', hint: 'آدرس کامل یک عکس PNG/JPG حدود ۱۲۰۰×۶۳۰؛ خالی = یک کارت ساده‌ی خودکار', kind: 'text', min: 0, max: 300, default: '' },
  { key: 'landing.og_image_alt', group: 'seo', label: 'متن جایگزین تصویر اشتراک‌گذاری', kind: 'text', min: 0, max: 200, default: '' },
  { key: 'landing.same_as', group: 'seo', label: 'نشانی‌های دیگر پروفایل رسمی', hint: 'مثل اینستاگرام، آپارات، لینکدین؛ با ویرگول جدا کن (به sameAs می‌رود)', kind: 'text', min: 0, max: 400, default: '' },
  { key: 'landing.font_url', group: 'seo', label: 'آدرس فایل فونت وب (woff2)', hint: 'روی سرور خودت؛ خالی = فونت فارسی سیستم. از فونت‌های گوگل استفاده نکن', kind: 'text', min: 0, max: 300, default: '' },
  { key: 'landing.indexable', group: 'seo', label: 'موتورهای جستجو سایت را ایندکس کنند', hint: 'خاموش = همه‌ی صفحه‌ها noindex و robots.txt همه چیز را می‌بندد (برای پیش از راه‌اندازی)', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'seo.verify_google', group: 'seo', label: 'کد تأیید مالکیت سرچ‌کنسول گوگل', hint: 'فقط مقدار content تگ google-site-verification', kind: 'text', min: 0, max: 100, default: '' },
  { key: 'seo.verify_bing', group: 'seo', label: 'کد تأیید مالکیت Bing', hint: 'مقدار content تگ msvalidate.01', kind: 'text', min: 0, max: 100, default: '' },
  { key: 'seo.verify_enamad', group: 'seo', label: 'کد تأیید ای‌نماد', hint: 'مقدار content تگ enamad', kind: 'text', min: 0, max: 100, default: '40890646' },
  { key: 'seo.verify_yandex', group: 'seo', label: 'کد تأیید مالکیت Yandex', hint: 'مقدار content تگ yandex-verification', kind: 'text', min: 0, max: 100, default: '' },
  { key: 'analytics.script_url', group: 'seo', label: 'آدرس اسکریپت آمار خودمیزبان (مثل Umami)', hint: 'مثل https://stats.example.ir/script.js روی سرور خودت؛ خالی = بدون آمار. از سرویس‌های گوگل استفاده نکن', kind: 'text', min: 0, max: 300, default: '' },
  { key: 'analytics.site_id', group: 'seo', label: 'شناسه‌ی سایت در سرویس آمار (data-website-id)', kind: 'text', min: 0, max: 100, default: '' },
  { key: 'link.badge_enamad', group: 'seo', label: 'لینک پایین سایت معرفی: نماد ای‌نماد', hint: 'نشانی کامل با https؛ نماد همیشه در فوتر سایت معرفی است و اگر این خالی باشد بدون لینک نشان داده می‌شود', kind: 'text', min: 0, max: 300, default: 'https://enamad.ir' },
  { key: 'link.badge_samandehi', group: 'seo', label: 'لینک پایین سایت معرفی: نماد ساماندهی', hint: 'نشانی کامل با https؛ نماد همیشه در فوتر سایت معرفی است و اگر این خالی باشد بدون لینک نشان داده می‌شود', kind: 'text', min: 0, max: 300, default: 'https://logo.samandehi.ir' },
  { key: 'link.badge_ersa', group: 'seo', label: 'لینک پایین سایت معرفی: نماد ارسا', hint: 'نشانی کامل با https؛ نماد همیشه در فوتر سایت معرفی است و اگر این خالی باشد بدون لینک نشان داده می‌شود', kind: 'text', min: 0, max: 300, default: '' },
  { key: 'link.badge_etehadieh', group: 'seo', label: 'لینک پایین سایت معرفی: نماد اتحادیه کسب‌وکارهای مجازی', hint: 'نشانی کامل با https؛ نماد همیشه در فوتر سایت معرفی است و اگر این خالی باشد بدون لینک نشان داده می‌شود', kind: 'text', min: 0, max: 300, default: 'https://ecunion.ir' },
  { key: 'link.badge_ircg', group: 'seo', label: 'لینک پایین سایت معرفی: نماد ircg', hint: 'نشانی کامل با https؛ نماد همیشه در فوتر سایت معرفی است و اگر این خالی باشد بدون لینک نشان داده می‌شود', kind: 'text', min: 0, max: 300, default: '' },
  { key: 'link.badge_bazaar', group: 'seo', label: 'لینک پایین سایت معرفی: کافه‌بازار', hint: 'نشانی کامل با https؛ نماد همیشه در فوتر سایت معرفی است و اگر این خالی باشد بدون لینک نشان داده می‌شود', kind: 'text', min: 0, max: 300, default: 'https://cafebazaar.ir' },
  { key: 'link.badge_myket', group: 'seo', label: 'لینک پایین سایت معرفی: مایکت', hint: 'نشانی کامل با https؛ نماد همیشه در فوتر سایت معرفی است و اگر این خالی باشد بدون لینک نشان داده می‌شود', kind: 'text', min: 0, max: 300, default: 'https://myket.ir' },
  { key: 'gate.phone_only', group: 'app', label: 'مرورگر کامپیوتر فقط کارت «با گوشی بیا» + QR ببیند', hint: 'گوشی اندروید کارت دانلود و آیفون راهنمای نصب می‌بیند؛ هر کدام دکمه‌ی «ادامه با مرورگر» دارند', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'link.app_url', group: 'app', label: 'آدرس بازی برای QR (خالی = همان صفحه)', kind: 'text', min: 0, max: 200, default: '' },
  { key: 'link.ios_app', group: 'app', label: 'لینک دانلود برنامه‌ی iOS', hint: 'خالی = «به‌زودی» نشان داده می‌شود', kind: 'text', min: 0, max: 300, default: '' },
  { key: 'link.android_app', group: 'app', label: 'لینک دانلود برنامه‌ی اندروید', hint: 'خالی = دکمه‌ی دانلود نشان داده نمی‌شود', kind: 'text', min: 0, max: 300, default: '' },
  { key: 'link.bale_bot', group: 'app', label: 'لینک ربات بله (بازی از طریق ربات)', hint: 'مثلاً https://ble.ir/dozari_bot؛ خالی = دکمه‌ی «بازی در بله» در صفحه‌ی دانلود نشان داده نمی‌شود', kind: 'text', min: 0, max: 200, default: '' },
  { key: 'feature.telegram_app', group: 'app', label: 'بازی از طریق تلگرام (مینی‌اپ) در سایت نشان داده شود', hint: 'فعلاً خاموش؛ وقتی روشن شود و لینک پایین پر باشد، دکمه‌ی «بازی در تلگرام» در صفحه‌ی دانلود می‌آید', kind: 'bool', min: 0, max: 1, default: 0 },
  { key: 'link.telegram_app', group: 'app', label: 'لینک مینی‌اپ تلگرام', hint: 'مثلاً https://t.me/dozari_bot/play؛ فقط با روشن بودن گزینه‌ی بالا نمایش داده می‌شود', kind: 'text', min: 0, max: 200, default: '' },
  { key: 'link.channel', group: 'app', label: 'لینک کانال (بله یا تلگرام‌مانند)', hint: 'خالی = ماموریت عضویت در کانال نمایش داده نمی‌شود', kind: 'text', min: 0, max: 200, default: '' },
  { key: 'levelreward.every', group: 'economy', label: 'جایزه‌ی سکه‌ی جاده‌ی لول: هر چند لول یک بار', hint: '۰ = خاموش', kind: 'int', min: 0, max: 50, default: LEVEL_REWARD_EVERY, unit: 'لول' },
  { key: 'levelreward.base_coins', group: 'economy', label: 'جایزه‌ی جاده‌ی لول: سکه‌ی پایه', hint: 'جایزه = پایه × (لول ÷ فاصله)؛ مثلاً ۲۵ → لول ۵: ۲۵، لول ۱۰: ۵۰', kind: 'int', min: 0, max: 10000, default: LEVEL_REWARD_BASE_COINS, unit: 'سکه' },
  { key: 'wheel.enabled', group: 'economy', label: 'گردونه‌ی شانس بعد از برد روشن باشد', hint: 'کل گردونه را روشن یا خاموش می‌کند؛ جایزه‌ها در بخش «گردونه»ی پنل', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'wheel.daily_spins', group: 'economy', label: 'چرخش رایگان گردونه برای هر بازیکن در روز', hint: '۰ = خاموش (پیش‌فرض: چرخش رایگان نداریم). با اولین نگاه به گردونه‌ی آن روز داده می‌شود', kind: 'int', min: 0, max: 10, default: 0, unit: 'چرخش' },
  { key: 'birthday.min_age', group: 'economy', label: 'کمترین سن برای ثبت تاریخ تولد', hint: 'تاریخی که بازیکن را کوچک‌تر از این سن نشان بدهد ذخیره نمی‌شود', kind: 'int', min: 5, max: 30, default: 10, unit: 'سال' },
  { key: 'birthday.week_before_days', group: 'economy', label: 'هفته‌ی تولد از چند روز قبل از تولد شروع شود', kind: 'int', min: 0, max: 10, default: 3, unit: 'روز' },
  { key: 'birthday.week_days', group: 'economy', label: 'هفته‌ی تولد چند روز طول بکشد', kind: 'int', min: 1, max: 14, default: 7, unit: 'روز' },
  { key: 'birthday.gift_coins', group: 'economy', label: 'سکه‌ی هدیه‌ی تولد (سالی یک بار)', hint: '۰ = بدون سکه', kind: 'int', min: 0, max: 100_000, default: 100, unit: 'سکه' },
  { key: 'birthday.gift_gems', group: 'economy', label: 'الماس هدیه‌ی تولد', kind: 'int', min: 0, max: 1000, default: 5, unit: 'الماس' },
  { key: 'birthday.gift_spins', group: 'economy', label: 'چرخش گردونه‌ی هدیه‌ی تولد', kind: 'int', min: 0, max: 20, default: 2, unit: 'چرخش' },
  { key: 'wheel.cosmetic_dupe_coins', group: 'economy', label: 'سکه‌ی جایگزین وقتی جایزه‌ی لباس یا کلاه را از قبل دارد', kind: 'int', min: 0, max: 100_000, default: 50, unit: 'سکه' },
  { key: 'wheel.refill_hours', group: 'economy', label: 'هر چند ساعت یک چرخش گردونه مثل «جان» پر شود', hint: '۰ = خاموش (پیش‌فرض: چرخش رایگان نداریم). فقط وقتی بازیکن گردونه را باز کند و کمتر از سقف چرخش داشته باشد یک چرخش می‌گیرد', kind: 'int', min: 0, max: 168, default: 0, unit: 'ساعت' },
  { key: 'wheel.refill_cap', group: 'economy', label: 'سقف چرخش‌های در انتظار برای پر شدن خودکار', kind: 'int', min: 1, max: 20, default: 3, unit: 'چرخش' },
  { key: 'wheel.win_spins', group: 'economy', label: 'برد دوئل زنده یک چرخش گردونه بدهد', hint: 'خاموش = چرخش فقط از خرید، سطح، تورنومنت و هدیه می‌آید', kind: 'bool', min: 0, max: 1, default: 0 },
  { key: 'wheel.prize_scale_percent', group: 'economy', label: 'مقیاس جایزه‌های سکه‌ای گردونه (۱۰۰ = همان مقدار جدول)', kind: 'int', min: 0, max: 1000, default: 100, unit: '٪' },
  { key: 'feature.tables', group: 'app', label: 'میز اختصاصی روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'tables.ambient_open', group: 'gameplay', label: 'میزهای باز با ربات در سفره‌خانه (همیشه این‌قدر باز باشد)', hint: 'برای نشان‌دادن شلوغی؛ آدم واقعی می‌تواند درخواست بنشیند و بازی شروع می‌شود. ۰ = خاموش', kind: 'int', min: 0, max: 30, default: 5 },
  { key: 'tables.ambient_playing', group: 'gameplay', label: 'میزهای «در حال بازی» نمایشی در سفره‌خانه', hint: 'ردیف‌های پر که فقط نشان داده می‌شوند. ۰ = خاموش', kind: 'int', min: 0, max: 30, default: 3 },
  { key: 'table.idle_minutes', group: 'gameplay', label: 'میز اختصاصی بعد از چند دقیقه بی‌استفاده بسته شود', kind: 'int', min: 1, max: 240, default: TABLE_IDLE_MINUTES, unit: 'دقیقه' },
  { key: 'feature.daily', group: 'app', label: 'پازل روز روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'daily.reward_coins', group: 'economy', label: 'جایزه‌ی حل پازل روز', hint: 'برای حل کامل، یک بار در روز', kind: 'int', min: 0, max: 1000, default: DAILY_PUZZLE_REWARD, unit: 'سکه' },
  { key: 'daily.streak_step', group: 'economy', label: 'افزایش جایزه به ازای هر روز پشت‌سرهم', kind: 'int', min: 0, max: 200, default: DAILY_PUZZLE_STREAK_STEP, unit: 'سکه' },
  { key: 'daily.streak_max_days', group: 'economy', label: 'سقف روزهای زنجیره برای افزایش جایزه', kind: 'int', min: 1, max: 60, default: DAILY_PUZZLE_STREAK_MAX_DAYS, unit: 'روز' },
  { key: 'daily.repeat_days', group: 'gameplay', label: 'پازل روز تا چند روز تکرار نشود', kind: 'int', min: 0, max: 365, default: DAILY_PUZZLE_REPEAT_DAYS, unit: 'روز' },
  { key: 'hint.price_group_title', group: 'economy', label: 'قیمت راهنما: نام یک دسته', hint: 'سکه برای هر بار گرفتن راهنما در بازی تکی', kind: 'int', min: 0, max: 5000, default: HINT_PRICES.group_title, unit: 'سکه' },
  { key: 'hint.price_one_card', group: 'economy', label: 'قیمت راهنما: یک کارت از یک دسته', kind: 'int', min: 0, max: 5000, default: HINT_PRICES.one_card, unit: 'سکه' },
  { key: 'hint.price_pair', group: 'economy', label: 'قیمت راهنما: دو کارت هم‌دسته', kind: 'int', min: 0, max: 5000, default: HINT_PRICES.pair, unit: 'سکه' },
  { key: 'duel.min_level', group: 'economy', label: 'کمترین لول برای دوئل زنده', hint: 'بازیکن تازه‌کار تا این لول فقط بازی تکی دارد', kind: 'int', min: 1, max: 100, default: DUEL_MIN_LEVEL },
  { key: 'hint.min_level', group: 'economy', label: 'کمترین لول برای گرفتن راهنما', kind: 'int', min: 1, max: 100, default: HINT_MIN_LEVEL },
  { key: 'hint.max_per_game', group: 'economy', label: 'حداکثر راهنما در هر بازی', kind: 'int', min: 1, max: 10, default: HINT_MAX_PER_GAME },
  { key: 'hint.repeat_percent', group: 'economy', label: 'قیمت راهنمای دوم به بعد (درصد قیمت اول)', hint: '۲۰۰ یعنی دو برابر', kind: 'int', min: 100, max: 1000, default: HINT_REPEAT_PERCENT, unit: '٪' },
  { key: 'feature.coin_packages', group: 'app', label: 'خرید بسته‌ی سکه با پول واقعی روشن باشد', hint: 'تا فروشگاه‌های بازار/مایکت وصل نشده خاموش بماند', kind: 'bool', min: 0, max: 1, default: 0 },
  { key: 'feature.shop', group: 'app', label: 'فروشگاه و راهنما روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'invite.min_level', group: 'economy', label: 'کمترین لول برای گرفتن کد معرف شخصی', hint: 'کد معرف ارزشمند است؛ تا این لول کدی داده نمی‌شود', kind: 'int', min: 1, max: 100, default: INVITE_MIN_LEVEL },
  { key: 'invite.max_uses', group: 'economy', label: 'هر کد معرف چند نفر را می‌تواند دعوت کند', kind: 'int', min: 1, max: 1000, default: INVITE_MAX_USES, unit: 'نفر' },
  { key: 'invite.invitee_bonus', group: 'economy', label: 'سکه‌ی دعوت‌شده بعد از واردکردن کد', kind: 'int', min: 0, max: 10000, default: INVITE_INVITEE_BONUS, unit: 'سکه' },
  { key: 'invite.inviter_reward', group: 'economy', label: 'سکه‌ی معرف', hint: 'بعد از اینکه دعوت‌شده چند بازی را تمام کرد', kind: 'int', min: 0, max: 10000, default: INVITE_INVITER_REWARD, unit: 'سکه' },
  { key: 'invite.reward_after_games', group: 'economy', label: 'پاداش معرف بعد از چند بازی تمام‌شده‌ی دعوت‌شده', kind: 'int', min: 1, max: 100, default: INVITE_REWARD_AFTER_GAMES, unit: 'بازی' },
  { key: 'invite.required_for_rename', group: 'profile', label: 'تغییر اسم نیازمند فعال‌بودن حساب با کد معرف باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'transfer.gifts_on', group: 'economy', label: 'هدیه‌دادن سکه بین دوستان روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'transfer.loans_on', group: 'economy', label: 'قرض‌دادن سکه بین دوستان روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'transfer.min_friend_days', group: 'economy', label: 'کمترین مدت دوستی برای هدیه و قرض', kind: 'int', min: 0, max: 365, default: TRANSFER_MIN_FRIEND_DAYS, unit: 'روز' },
  { key: 'transfer.min_level', group: 'economy', label: 'کمترین لول فرستنده برای هدیه و قرض', kind: 'int', min: 1, max: 100, default: TRANSFER_MIN_LEVEL },
  { key: 'transfer.weekly_cap', group: 'economy', label: 'سقف سکه‌ی فرستادنی در هفته (هدیه + قرض)', hint: 'جمع در هر ۷ روز گذشته', kind: 'int', min: 0, max: 100000, default: TRANSFER_WEEKLY_CAP, unit: 'سکه' },
  { key: 'transfer.min_amount', group: 'economy', label: 'کمترین مبلغ هر انتقال', kind: 'int', min: 1, max: 100000, default: TRANSFER_MIN_AMOUNT, unit: 'سکه' },
  { key: 'transfer.max_amount', group: 'economy', label: 'بیشترین مبلغ هر انتقال', kind: 'int', min: 1, max: 100000, default: TRANSFER_MAX_AMOUNT, unit: 'سکه' },
  { key: 'keepsake.drop_percent', group: 'economy', label: 'شانس افتادن یک تکه‌ی یادگار بعد از هر برد مقابل آدم', hint: 'درصد؛ ۰ = تکه‌ی جایزه‌ای نمی‌افتد (خرید با سکه همچنان هست)', kind: 'int', min: 0, max: 100, default: Math.round(KEEPSAKE_DROP_CHANCE * 100), unit: '٪' },
  { key: 'shop.daily_slots', group: 'economy', label: 'تعداد کالای چرخان فروشگاه در روز', hint: 'از بین کالاهایی که «چرخان» علامت خورده‌اند هر روز (ساعت صفر تهران) همین تعداد نمایش داده می‌شود؛ ۰ = همه همیشه', kind: 'int', min: 0, max: 50, default: DAILY_SHOP_SLOTS },
  { key: 'transfer.gift_fee_percent', group: 'economy', label: 'کارمزد هدیه‌ی سکه (درصد سوخته‌شده)', hint: 'گیرنده مبلغ منهای این سهم را می‌گیرد؛ قرض کارمزد ندارد. ۰ = بدون کارمزد', kind: 'int', min: 0, max: 50, default: GIFT_FEE_PERCENT, unit: '٪' },
  { key: 'transfer.needs_activation', group: 'economy', label: 'فرستنده باید حسابش را با کد معرف فعال کرده باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'loan.due_days', group: 'economy', label: 'مهلت پس‌دادن قرض', kind: 'int', min: 1, max: 90, default: LOAN_DUE_DAYS, unit: 'روز' },
  { key: 'loan.max_open', group: 'economy', label: 'حداکثر قرض باز برای هر نفر', kind: 'int', min: 1, max: 10, default: LOAN_MAX_OPEN },
  { key: 'phone.required_for_bale', group: 'profile', label: 'برای اتصال به بله اول باید شماره‌ی موبایل ثبت شود', hint: 'شماره با ارسال مخاطب در ربات بله (یا پیامک) تأیید می‌شود', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'phone.sms_ttl_minutes', group: 'profile', label: 'مدت اعتبار کد پیامکی', kind: 'int', min: 1, max: 30, default: 5, unit: 'دقیقه' },
  { key: 'phone.sms_resend_seconds', group: 'profile', label: 'فاصله‌ی دوبار فرستادن پیامک', kind: 'int', min: 10, max: 600, default: 60, unit: 'ثانیه' },
  { key: 'link.invite_base', group: 'app', label: 'آدرس پایه‌ی لینک دعوت دوست', hint: 'ID بازیکن به انتهای آن اضافه می‌شود؛ مثل https://dozari.app/i/ (تا وقتی دامنه نیست، dozari://i/)', kind: 'text', min: 0, max: 200, default: 'dozari://i/' },
  { key: 'link.shortener_url', group: 'app', label: 'آدرس سرویس کوتاه‌کننده‌ی لینک', hint: 'آدرسی که {url} در آن جایگزین لینک می‌شود؛ مثل https://example.com/api?url={url} . خالی = لینک کوتاه نمی‌شود', kind: 'text', min: 0, max: 300, default: '' },
  { key: 'friend.link_auto_hours', group: 'app', label: 'حساب‌های تازه‌تر از این مدت با لینک دعوت فوری دوست می‌شوند', kind: 'int', min: 0, max: 168, default: 24, unit: 'ساعت' },
  { key: 'friend.link_auto_per_day', group: 'app', label: 'سقف دوستی خودکار با لینک برای هر نفر در روز', kind: 'int', min: 0, max: 500, default: 20 },
  { key: 'skill.min_games', group: 'profile', label: 'بازی لازم تا از «تازه‌کار» رد شود', kind: 'int', min: 1, max: 500, default: SKILL_MIN_GAMES, unit: 'بازی' },
  { key: 'skill.pro_games', group: 'profile', label: 'بازی لازم برای «حرفه‌ای» شدن', kind: 'int', min: 1, max: 1000, default: SKILL_PRO_GAMES, unit: 'بازی' },
  { key: 'skill.pro_win_percent', group: 'profile', label: 'درصد برد لازم برای «حرفه‌ای» شدن', kind: 'int', min: 1, max: 100, default: SKILL_PRO_WIN_PERCENT, unit: '٪' },
  { key: 'mod.max_mute_minutes', group: 'app', label: 'بیشترین مدت سکوت که آجان دوزاری می‌تواند بدهد', kind: 'int', min: 1, max: 1440, default: 60, unit: 'دقیقه' },
  { key: 'mod.agent_actions_per_day', group: 'app', label: 'سقف اخطار و سکوت هر آجان در روز', kind: 'int', min: 1, max: 500, default: 20 },
  { key: 'feature.tournament', group: 'app', label: 'تورنومنت روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'feature.chat', group: 'app', label: 'چت روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'chat.max_len', group: 'app', label: 'بیشترین طول پیام چت', kind: 'int', min: 20, max: 500, default: CHAT_MAX_LEN, unit: 'حرف' },
  { key: 'chat.global_enabled', group: 'app', label: 'چت کلی (همهٔ بازیکن‌ها، کنار چت شهر)', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'chat.text_needs_activation', group: 'app', label: 'پیام آزاد فقط برای حساب فعال‌شده با کد معرف', hint: 'کل‌کل‌های آماده همیشه آزاد است', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'match.price_round', group: 'gameplay', label: 'دور حدس قیمت بعد از دوئل یک‌به‌یک', hint: 'خاموش (۰): دوئل مثل قبل با پازل تمام می‌شود. روشن (۱): بعد از پازل ۴ دور حدس قیمتِ کور و هم‌زمان؛ فقط وقتی پازل مساوی شده برنده را تعیین می‌کند و بازنده‌ی قفل‌شده امتیاز تسلی می‌گیرد. بازی‌هایی که از قبل شروع شده‌اند تغییر نمی‌کنند.', kind: 'bool', min: 0, max: 1, default: 0 },
  { key: 'match.team_boards', group: 'gameplay', label: 'تعداد بسته‌ی ۱۶تایی در بازی تیمی ۲ در ۲', hint: 'امتیازها جمع می‌شود؛ ۱ یعنی مثل دوئل', kind: 'int', min: 1, max: 5, default: TEAM_MATCH_BOARDS },
  { key: 'puzzles.autofill_enabled', group: 'gameplay', label: 'پر کردن خودکار استخر پازل روشن باشد', hint: 'کار زمان‌بندی‌شده پازل تازه از کالاهای کاتالوگ می‌سازد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'puzzles.autofill_target', group: 'gameplay', label: 'تعداد پازل آماده در استخر', hint: 'پیش‌نویس‌های منتظر تأیید (یا پازل‌های تأییدشده، اگر تأیید خودکار روشن است) تا این عدد پر می‌شود', kind: 'int', min: 1, max: 200, default: 30 },
  { key: 'puzzles.autofill_check_minutes', group: 'gameplay', label: 'هر چند دقیقه استخر پازل بررسی شود', kind: 'int', min: 5, max: 1440, default: 60, unit: 'دقیقه' },
  { key: 'puzzles.autofill_auto_approve', group: 'gameplay', label: 'پازل‌های ساخته‌شده بدون بازبینی انسان منتشر شوند', hint: 'خاموش (پیشنهادی): فقط پیش‌نویس می‌شود و ادمین عنوان می‌نویسد؛ روشن: با عنوانِ ساده‌ی قانون منتشر می‌شود', kind: 'bool', min: 0, max: 1, default: 0 },
  { key: 'bots.enabled', group: 'bot', label: 'بازیکن‌های ربات (بازی‌کننده‌ی طبیعی) فعال باشند', hint: 'اگر خاموش باشد کسی با ربات جفت نمی‌شود', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'bots.fallback_seconds', group: 'bot', label: 'بعد از چند ثانیه انتظار در صف، حریف ربات پیدا شود', kind: 'int', min: 3, max: 300, default: 8, unit: 'ثانیه' },
  { key: 'bots.fallback_jitter_seconds', group: 'bot', label: 'تأخیر تصادفی اضافه برای طبیعی‌شدن', kind: 'int', min: 0, max: 120, default: 4, unit: 'ثانیه' },
  { key: 'bots.city_reply_percent', group: 'bot', label: 'احتمال جواب کوتاه یک ربات همشهری به پیام چت', kind: 'int', min: 0, max: 100, default: 15, unit: '٪' },
  { key: 'bots.autofill_min', group: 'bot', label: 'حداقل تعداد ربات؛ کم‌تر بود خودکار ساخته شود', hint: 'بدون ربات و بدون هم‌بازی واقعی، جستجوی حریف تمام نمی‌شود. ۰ = خاموش', kind: 'int', min: 0, max: 300, default: 12 },
  { key: 'chart.gap_break_years', group: 'chart', label: 'شکاف سال در نمودار قیمت', hint: 'بیشتر از این تعداد سال بدون داده، خط نمودار قطع می‌شود', kind: 'int', min: 1, max: 30, default: CHART_GAP_BREAK_YEARS, unit: 'سال' },
  { key: 'chart.min_year', group: 'chart', label: 'اولین سال نمودار', kind: 'int', min: 1200, max: 1400, default: CHART_MIN_YEAR },
  { key: 'bot.enabled', group: 'bot', label: 'ربات محتوا روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'bot.check_minutes', group: 'bot', label: 'هر چند دقیقه یک بار منبع‌های سررسید را بررسی کند', kind: 'int', min: 5, max: 1440, default: 60, unit: 'دقیقه' },
  { key: 'notify.match_result', group: 'notify', label: 'نتیجه‌ی بازی به بله فرستاده شود', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'notify.daily_ready', group: 'notify', label: 'آماده شدن جایزه‌ی روزانه به بله فرستاده شود', kind: 'bool', min: 0, max: 1, default: 1 },
  ...TRACK_FEATURE_DEFS,
  { key: 'bot.max_candidates_per_run', group: 'bot', label: 'سقف پیشنهاد در هر اجرا', hint: 'برای اینکه صف تأیید یک‌جا پر نشود', kind: 'int', min: 1, max: 500, default: 100 },
];

export type SettingValue = number | number[] | string;

export function settingDef(key: string): SettingDef | undefined {
  return SETTING_DEFS.find((d) => d.key === key);
}

/** Parses the stored text of an override; returns null when it is not valid for this definition. */
export function parseSetting(def: SettingDef, raw: string): SettingValue | null {
  if (def.kind === 'text') {
    const text = raw.trim();
    return [...text].length <= def.max && !/[\u0000-\u001f]/.test(text) ? text : null;
  }
  const parts = raw
    .trim()
    .split(/[,،\s]+/)
    .filter((p) => p !== '');
  if (parts.length === 0 || parts.some((p) => !/^-?\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => n < def.min || n > def.max)) return null;
  if (def.kind === 'intList') {
    if (nums.length !== def.length) return null;
    return nums;
  }
  return nums.length === 1 ? (nums[0] as number) : null;
}

export function formatSetting(value: SettingValue | readonly number[]): string {
  return Array.isArray(value) ? value.join(',') : String(value);
}

/** Effective values: the default, or the stored override when it still parses. */
export function effectiveSettings(overrides: Readonly<Record<string, string>>): Record<string, SettingValue> {
  const out: Record<string, SettingValue> = {};
  for (const def of SETTING_DEFS) {
    const raw = overrides[def.key];
    const parsed = raw === undefined ? null : parseSetting(def, raw);
    out[def.key] = parsed ?? (Array.isArray(def.default) ? [...(def.default as readonly number[])] : (def.default as number | string));
  }
  return out;
}
