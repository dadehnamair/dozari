---
name: result-chart
description: Build or change the post-match overlaid price-history line chart and its shareable image card (screenshot + share, growth loop with invite code). Use for chart data building, log scale, gaps, legends, share card layout, react-native-svg/victory-native, view-shot, or requests like «چارت قیمت» / «اشتراک‌گذاری نتیجه».
---

# Result chart & share

Spec: `docs/logic/result-chart.md`.

## Must-haves

- **Overlaid** lines (one chart, 4 series) — not small multiples (brief).
- Data built by pure `buildChartData()` in `packages/shared` (tested); UI only renders it.
- Log Y scale by default; Persian compact toman labels; X = Solar Hijri years, time runs left→right inside an
  `direction:'ltr'` container.
- Break lines over gaps > 5 years; dots only at real data points; never fabricate/interpolate values shown as data.
- Mark the group's rule year (dashed vertical line) when the rule has one.
- Group tabs (yellow/green/blue/purple), default purple.
- Dark mode + light mode.

## Share card

- Separate off-screen component (1080×1350) so the capture is identical on all devices; captured with
  `react-native-view-shot` (`captureRef`, png), shared with `expo-sharing`.
- Contents: logo/name, group title, chart, 4 thumbnails + names, one punchy Persian line, invite code + short URL.
- Images inside the card must be loaded before capture (await `Image.prefetch`), otherwise blank thumbnails.
- No Google-hosted assets; all fonts bundled (Vazirmatn) — otherwise the captured PNG falls back to system font.

## Tests

- `buildChartData`: sorting, month-median aggregation, gap breaking, domain clamp, marker year.
- Formatter snapshots for labels.
