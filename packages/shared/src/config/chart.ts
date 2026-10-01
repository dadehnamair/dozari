/** Result-chart tunables (docs/logic/result-chart.md). Numbers live here per rule 9. */

/** A gap wider than this many years breaks the line instead of being drawn straight across. */
export const CHART_GAP_BREAK_YEARS = 5;

/** The X domain never starts before this Solar Hijri year. */
export const CHART_MIN_YEAR = 1340;

/** Fixed categorical series colours s1..s4 (prototype/index.html); light and dark variants. */
export const CHART_SERIES_COLORS = {
  light: ['#D9482B', '#2A6FC9', '#2E8F4E', '#8E44C9'],
  dark: ['#FF7A5C', '#63A4FF', '#5CCB7E', '#C28CFF'],
} as const;
