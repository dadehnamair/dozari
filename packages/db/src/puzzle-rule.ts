import { ruleSchema } from '@dozari/shared';
import type { Rule } from '@dozari/shared';
import type { puzzleGroups } from './schema.js';

/** The `rule_*` columns of `puzzle_groups`; every one is null unless the rule kind uses it. */
export type RuleColumns = Pick<
  typeof puzzleGroups.$inferInsert,
  | 'ruleKind'
  | 'ruleYear'
  | 'ruleYearB'
  | 'ruleMinRials'
  | 'ruleMaxRials'
  | 'ruleTargetRials'
  | 'ruleThresholdRials'
  | 'ruleTolerancePct'
  | 'ruleFromYear'
  | 'ruleToYear'
  | 'ruleMinX'
  | 'ruleMaxX'
  | 'ruleRank'
  | 'ruleRefProductId'
  | 'ruleEraTag'
  | 'ruleCategory'
  | 'ruleNote'
>;

const EMPTY: Omit<RuleColumns, 'ruleKind'> = {
  ruleYear: null,
  ruleYearB: null,
  ruleMinRials: null,
  ruleMaxRials: null,
  ruleTargetRials: null,
  ruleThresholdRials: null,
  ruleTolerancePct: null,
  ruleFromYear: null,
  ruleToYear: null,
  ruleMinX: null,
  ruleMaxX: null,
  ruleRank: null,
  ruleRefProductId: null,
  ruleEraTag: null,
  ruleCategory: null,
  ruleNote: null,
};

const big = (n: number) => BigInt(n);

/** Flatten a (zod-valid) rule into column values. */
export function ruleToColumns(input: Rule): RuleColumns {
  const rule = ruleSchema.parse(input);
  switch (rule.kind) {
    case 'price_band_at_year':
      return { ...EMPTY, ruleKind: rule.kind, ruleYear: rule.year, ruleMinRials: big(rule.min), ruleMaxRials: big(rule.max) };
    case 'same_price_at_year':
      return { ...EMPTY, ruleKind: rule.kind, ruleYear: rule.year, ruleTargetRials: big(rule.target), ruleTolerancePct: rule.tolerancePct };
    case 'first_crossed':
      return { ...EMPTY, ruleKind: rule.kind, ruleThresholdRials: big(rule.threshold), ruleFromYear: rule.fromYear, ruleToYear: rule.toYear };
    case 'multiplier_between':
      return { ...EMPTY, ruleKind: rule.kind, ruleYear: rule.yearA, ruleYearB: rule.yearB, ruleMinX: rule.minX, ruleMaxX: rule.maxX };
    case 'cheaper_than_ref':
      return { ...EMPTY, ruleKind: rule.kind, ruleYear: rule.year, ruleRefProductId: rule.refProductId };
    case 'era_icon':
      return { ...EMPTY, ruleKind: rule.kind, ruleEraTag: rule.eraTag };
    case 'category_price_rank':
      return { ...EMPTY, ruleKind: rule.kind, ruleYear: rule.year, ruleCategory: rule.category as RuleColumns['ruleCategory'], ruleRank: rule.rank };
    case 'theme_tag':
      return { ...EMPTY, ruleKind: rule.kind, ruleEraTag: rule.theme };
    case 'curated':
      return { ...EMPTY, ruleKind: rule.kind, ruleNote: rule.note };
  }
}

/** Rebuild a rule from a stored row; throws if the row does not form a valid rule (corrupt data). */
export function columnsToRule(row: RuleColumns): Rule {
  const num = (v: bigint | null | undefined) => (v === null || v === undefined ? undefined : Number(v));
  const candidate = (() => {
    switch (row.ruleKind) {
      case 'price_band_at_year':
        return { kind: row.ruleKind, year: row.ruleYear, min: num(row.ruleMinRials), max: num(row.ruleMaxRials) };
      case 'same_price_at_year':
        return { kind: row.ruleKind, year: row.ruleYear, target: num(row.ruleTargetRials), tolerancePct: row.ruleTolerancePct };
      case 'first_crossed':
        return { kind: row.ruleKind, threshold: num(row.ruleThresholdRials), fromYear: row.ruleFromYear, toYear: row.ruleToYear };
      case 'multiplier_between':
        return { kind: row.ruleKind, yearA: row.ruleYear, yearB: row.ruleYearB, minX: row.ruleMinX, maxX: row.ruleMaxX };
      case 'cheaper_than_ref':
        return { kind: row.ruleKind, year: row.ruleYear, refProductId: row.ruleRefProductId };
      case 'era_icon':
        return { kind: row.ruleKind, eraTag: row.ruleEraTag };
      case 'category_price_rank':
        return { kind: row.ruleKind, year: row.ruleYear, category: row.ruleCategory, rank: row.ruleRank };
      case 'theme_tag':
        return { kind: row.ruleKind, theme: row.ruleEraTag };
      case 'curated':
        return { kind: row.ruleKind, note: row.ruleNote };
    }
  })();
  return ruleSchema.parse(candidate);
}
