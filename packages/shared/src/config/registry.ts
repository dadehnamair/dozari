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
  SOLO_MAX_MISTAKES,
  TURN_SECONDS,
} from './game.js';
import { DAILY_REWARD_COOLDOWN_HOURS, DAILY_REWARD_STREAK_WINDOW_HOURS } from './economy.js';
import { CHART_GAP_BREAK_YEARS, CHART_MIN_YEAR } from './chart.js';

/**
 * Every tunable the admin panel can change. The defaults come from the constants in `config/*.ts` (CLAUDE.md rule 9);
 * an override is a row in `app_settings`. Values are integers or short lists of integers (stored as "1,2,3,4", no JSON).
 */
export const SETTING_GROUPS = ['gameplay', 'scoring', 'profile', 'economy', 'chart', 'bot', 'notify'] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number];

export interface SettingDef {
  key: string;
  group: SettingGroup;
  label: string;
  hint?: string;
  kind: 'int' | 'bool' | 'intList';
  min: number;
  max: number;
  /** For lists: exact length. */
  length?: number;
  default: number | readonly number[];
  unit?: string;
}

export const SETTING_DEFS: readonly SettingDef[] = [
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
  { key: 'economy.daily_cooldown_hours', group: 'economy', label: 'فاصله‌ی دریافت جایزه‌ی روزانه', kind: 'int', min: 1, max: 72, default: DAILY_REWARD_COOLDOWN_HOURS, unit: 'ساعت' },
  { key: 'economy.daily_streak_window_hours', group: 'economy', label: 'مهلت ادامه‌ی زنجیره‌ی جایزه', hint: 'دریافت بعدی تا این مدت بعد از قبلی، زنجیره را ادامه می‌دهد؛ دیرتر از آن از روز اول شروع می‌شود', kind: 'int', min: 2, max: 168, default: DAILY_REWARD_STREAK_WINDOW_HOURS, unit: 'ساعت' },
  { key: 'chart.gap_break_years', group: 'chart', label: 'شکاف سال در نمودار قیمت', hint: 'بیشتر از این تعداد سال بدون داده، خط نمودار قطع می‌شود', kind: 'int', min: 1, max: 30, default: CHART_GAP_BREAK_YEARS, unit: 'سال' },
  { key: 'chart.min_year', group: 'chart', label: 'اولین سال نمودار', kind: 'int', min: 1200, max: 1400, default: CHART_MIN_YEAR },
  { key: 'bot.enabled', group: 'bot', label: 'ربات محتوا روشن باشد', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'bot.check_minutes', group: 'bot', label: 'هر چند دقیقه یک بار منبع‌های سررسید را بررسی کند', kind: 'int', min: 5, max: 1440, default: 60, unit: 'دقیقه' },
  { key: 'notify.match_result', group: 'notify', label: 'نتیجه‌ی بازی به بله فرستاده شود', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'notify.daily_ready', group: 'notify', label: 'آماده شدن جایزه‌ی روزانه به بله فرستاده شود', kind: 'bool', min: 0, max: 1, default: 1 },
  { key: 'bot.max_candidates_per_run', group: 'bot', label: 'سقف پیشنهاد در هر اجرا', hint: 'برای اینکه صف تأیید یک‌جا پر نشود', kind: 'int', min: 1, max: 500, default: 100 },
];

export type SettingValue = number | number[];

export function settingDef(key: string): SettingDef | undefined {
  return SETTING_DEFS.find((d) => d.key === key);
}

/** Parses the stored text of an override; returns null when it is not valid for this definition. */
export function parseSetting(def: SettingDef, raw: string): SettingValue | null {
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
    out[def.key] = parsed ?? (Array.isArray(def.default) ? [...(def.default as readonly number[])] : (def.default as number));
  }
  return out;
}
