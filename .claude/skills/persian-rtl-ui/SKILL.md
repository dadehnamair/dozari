---
name: persian-rtl-ui
description: Build or fix React Native (Expo) UI for the Persian game — RTL layout, Persian/Arabic digit handling, toman formatting, Jalali years, fonts, i18n strings, ZWNJ, bidi issues with mixed Latin/Persian text. Use for any screen/component work in apps/mobile or when text/number display looks wrong («راست‌چین»، «فونت»، «اعداد فارسی»).
---

# Persian RTL UI

## Setup (Phase 0)

- Force RTL once at startup: `I18nManager.allowRTL(true); I18nManager.forceRTL(true);` (requires reload on
  first launch — handle with `expo-updates`/`Updates.reloadAsync()` guarded by a flag). Expo config:
  `"extra": {"supportsRTL": true}` / `expo-localization`.
- Font: **Vazirmatn** bundled via `expo-font` (weights 400/500/700). No Google Fonts at runtime.
  Set as default `fontFamily` in the theme `Text` wrapper — use our `<Text>` component, not RN's directly.
- Second, **display-only** font for titles/logo/brand moments per `docs/brand-visual.md` — nostalgic/
  vintage feel, distinct from Vazirmatn. Exact family **not chosen yet** (`brand-visual.md` §Open
  follow-ups); don't hardcode a placeholder as if it were final.

## Layout

- Use logical properties: `marginStart/End`, `paddingStart/End`, `start/end` — never `left/right`.
- `flexDirection: 'row'` auto-flips under RTL; don't manually reverse.
- Icons with direction (back arrow, chevrons) must be mirrored: `transform: [{scaleX: I18nManager.isRTL ? -1 : 1}]`.
- The 4×4 board reads right-to-left; the chart X axis (time) stays **left→right** (conventional for time
  series even in Persian UIs) — wrap chart in `direction: 'ltr'` and keep labels Persian.

## Text & numbers

- All UI strings in `apps/mobile/src/i18n/fa.ts` (typed object, keys in English). No inline Persian in components.
- Digits: display Persian digits (۰–۹) via `toPersianDigits` from `packages/shared/src/format`.
  **Parse** user input accepting Persian, Arabic-Indic (٠–٩) and Latin digits.
- Money: `formatToman(rials, {compact?})` → «۱۲٬۵۰۰ تومان» / compact «۱۲٫۵ هزار تومن». Thousands separator
  `٬` (U+066C), decimal `٫` (U+066B).
- Years: «سال ۱۳۷۵» or short «۷۵» in playful copy.
- Normalize ی/ک (Arabic ي/ك → Persian) on every text input before storing/searching.
- Use ZWNJ (U+200C) correctly in strings: «می‌خری»، «کل‌کل‌ها». Don't strip it.
- Mixed Latin inside Persian (room codes, nicknames): wrap in `⁨…⁩` (FSI/PDI) to avoid bidi scramble.

## Visual language

Full brand direction: `docs/brand-visual.md` (mood, typography, color, icon — several pieces still open,
read it before making a visual call this file doesn't already answer).

- Group colors (Connections-like, tuned for dark & light): yellow `#F9DF6D`, green `#A0C35A`, blue `#B0C4EF`,
  purple `#BA81C5`. Define in theme tokens; text on them must pass WCAG AA. These are **locked**.
- Nostalgic + playful mood (`brand-visual.md`): warm paper background (exact tokens **not chosen yet**),
  retro product photos, group colors carry the "playful" energy — don't let them bleed into large
  background fills, keep the paper tone as the quiet base. Keep tap targets ≥ 44 pt.
- Support dark mode from day one (theme tokens, no hard-coded colors); dark mode should still read
  as "warm paper", not neutral gray (`brand-visual.md` §Color).

## Testing

- Snapshot/visual check in both RTL and dark mode.
- Unit-test formatters in shared (edge cases: 0, 5 rials → «۰٫۵ تومان», billions, negative coin deltas).
