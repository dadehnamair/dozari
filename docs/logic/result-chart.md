# Post-match price chart & sharing

Brief: after each match show an **overlaid** (not small-multiples) line chart of the price history of
the 4 items, screenshot-able and shareable.

## Which 4 items

Default: the **purple** (hardest) group — it carries the best story. The user can switch between the
4 groups with color tabs (yellow/green/blue/purple); each tab = one overlaid chart of that group's 4 items.

## Data builder (`buildChartData(groupItems, pricePoints)` in shared)

- X axis: Solar Hijri years; domain = min..max year across the 4 series (clamped to ≥ 1340).
- Series per product: approved points sorted by year; months aggregated by median.
- Gaps: do not interpolate across gaps > 5 years (break the line); smaller gaps drawn straight, points
  marked only at real data.
- Y axis: **log scale** by default (prices span 1 toman → millions); toggle to linear.
  Labels in toman with Persian digits and compact units: «۱۰۰ تومن»، «۱٫۲ هزار»، «۳ میلیون»، «۱٫۵ میلیارد».
- Highlight the rule year (if the group's rule references one) with a vertical dashed line and label «سال ۷۵».
- Implemented in `packages/shared/src/chart/build.ts` (`buildChartData`, `normalizeX`, `normalizeY`) with tunables in
  `config/chart.ts` (`CHART_GAP_BREAK_YEARS` = 5, `CHART_MIN_YEAR` = 1340, the fixed s1–s4 series colours). Points
  carry `breakBefore` where a gap > 5 years breaks the line; the Y domain is returned in integer rials and only
  `normalizeY` does display-only float maths. Axis labels: `compactTomanLabel` («۱۰۰ تومن»، «۱٫۲ هزار»، «۳ میلیون»).
- Output is plain data (`{ years, series:[{productId, name, color, points:[{year, rials}]}], markers }`)
  so it is unit-testable and reusable by the web share page.

## Rendering (mobile)

- Series colors: 4 distinct hues within the group's color family is hard to read → use a fixed
  categorical palette of 4 high-contrast colors + the group color as a header band. Legend = product
  thumbnails + names (RTL order).
- Tap a point → tooltip: name, year, price.
- Chart must work in dark mode.

## Share card

- Off-screen composed view (1080×1350): game logo, group title, chart, the 4 item thumbnails, a line like
  «سال ۷۵ با ۱۰۰ تومن اینا رو می‌خریدی!», footer with room/invite code + short URL.
- Capture with `react-native-view-shot`, share with `expo-sharing`. Include the user's invite code in the
  URL (growth loop → invite reward).
- Share button available on result screen and in match history.
