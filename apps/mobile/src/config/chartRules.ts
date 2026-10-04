import { CHART_GAP_BREAK_YEARS, CHART_MIN_YEAR } from '@dozari/shared';

/** The admin's chart limits (`chart.min_year`, `chart.gap_break_years`) as last served by `GET /config`; the shared defaults until then. */
export interface ChartRules {
  minYear: number;
  gapBreakYears: number;
}

const int = (v: unknown, lo: number, hi: number, fallback: number): number => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : fallback);

export function chartRulesFrom(settings: Record<string, unknown>): ChartRules {
  return { minYear: int(settings['chart.min_year'], 1200, 1400, CHART_MIN_YEAR), gapBreakYears: int(settings['chart.gap_break_years'], 1, 100, CHART_GAP_BREAK_YEARS) };
}

let current: ChartRules = chartRulesFrom({});
export const setChartRules = (settings: Record<string, unknown>): void => void (current = chartRulesFrom(settings));
export const getChartRules = (): ChartRules => current;
