import { describe, expect, it } from 'vitest';
import { CHART_GAP_BREAK_YEARS, CHART_MIN_YEAR } from '@dozari/shared';
import { chartRulesFrom } from '../chartRules';

describe('chart rules from the admin config', () => {
  it('uses the shared defaults when nothing is set', () => {
    expect(chartRulesFrom({})).toEqual({ minYear: CHART_MIN_YEAR, gapBreakYears: CHART_GAP_BREAK_YEARS });
  });
  it('takes valid numbers and ignores nonsense', () => {
    expect(chartRulesFrom({ 'chart.min_year': 1350, 'chart.gap_break_years': 5 })).toEqual({ minYear: 1350, gapBreakYears: 5 });
    expect(chartRulesFrom({ 'chart.min_year': 'x', 'chart.gap_break_years': 0 })).toEqual({ minYear: CHART_MIN_YEAR, gapBreakYears: CHART_GAP_BREAK_YEARS });
  });
});
