import { describe, expect, it } from 'vitest';
import { RULE_KINDS } from '@dozari/shared';
import type { Rule } from '@dozari/shared';
import { columnsToRule, ruleToColumns } from '../puzzle-rule.js';
import { RULE_KIND_VALUES } from '../schema.js';

const REF = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const rules: Rule[] = [
  { kind: 'price_band_at_year', year: 1375, min: 900_000, max: 1_100_000 },
  { kind: 'same_price_at_year', year: 1380, target: 5_000_000, tolerancePct: 10 },
  { kind: 'first_crossed', threshold: 10_000_000, fromYear: 1380, toYear: 1389 },
  { kind: 'multiplier_between', yearA: 1370, yearB: 1400, minX: 80, maxX: 120 },
  { kind: 'cheaper_than_ref', year: 1380, refProductId: REF },
  { kind: 'era_icon', eraTag: 'dahe-60' },
  { kind: 'category_price_rank', year: 1370, category: 'snack', rank: 3 },
  { kind: 'curated', note: 'hand made' },
];

describe('rule <-> columns', () => {
  it('keeps the DB enum in sync with the shared rule kinds', () => {
    expect([...RULE_KIND_VALUES]).toEqual([...RULE_KINDS]);
  });

  it.each(rules)('round-trips %j', (rule) => {
    expect(columnsToRule(ruleToColumns(rule))).toEqual(rule);
  });

  it('only fills the columns a kind uses', () => {
    const cols = ruleToColumns({ kind: 'era_icon', eraTag: 'dahe-60' });
    const filled = Object.entries(cols).filter(([, v]) => v !== null).map(([k]) => k);
    expect(filled.sort()).toEqual(['ruleEraTag', 'ruleKind']);
  });

  it('stores rials as bigint', () => {
    const cols = ruleToColumns({ kind: 'price_band_at_year', year: 1375, min: 1, max: 2 });
    expect(cols.ruleMinRials).toBe(1n);
  });

  it('rejects invalid rules and corrupt rows', () => {
    expect(() => ruleToColumns({ kind: 'price_band_at_year', year: 1375, min: 9, max: 1 })).toThrow();
    const row = ruleToColumns({ kind: 'price_band_at_year', year: 1375, min: 1, max: 2 });
    expect(() => columnsToRule({ ...row, ruleMaxRials: null })).toThrow();
  });
});
