import { estimateDifficulty, evaluateRule, relaxRule } from './rules/index.js';
import type { Rule } from './rules/index.js';
import { makeRuleContext } from './types.js';
import type { Catalog, CatalogProduct } from './types.js';

export type Level = 0 | 1 | 2 | 3;

export interface PuzzleGroupInput {
  level: Level;
  rule: Rule;
  productIds: readonly string[];
}

export interface PuzzleInput {
  groups: readonly PuzzleGroupInput[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  level?: Level;
  productId?: string;
}

export interface ValidationResult {
  /** True iff there are no hard failures (checks 1-4). Soft warnings never block saving. */
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** Cross-group (item, group) pairs that fit a relaxed rule but not the strict one. */
  nearMisses: { productId: string; level: Level }[];
  /** 0..100; each soft warning costs 10. Meaningless when `ok` is false. */
  score: number;
}

export const MIN_NEAR_MISSES = 2;
export const MAX_ITEMS_PER_CATEGORY = 6;
export const MIN_CATEGORIES = 3;
const DIFFICULTY_TOLERANCE = 0.1;

/**
 * Validates a puzzle against docs/logic/puzzle-generation.md §Validation.
 * Hard (block saving): 1 shape, 2 data availability, 3 membership, 4 uniqueness.
 * Soft (warnings): 5 near misses, 6 diversity, 7 difficulty ordering.
 *
 * Uniqueness is conservative: if an outside item's data cannot prove it fails a group's rule
 * (`unknown`), that is a hard error, because "exactly one solution" would be unproven.
 * `curated` groups skip checks 2-3 and are not used as the rule in check 4; human approval covers them.
 */
export function validatePuzzle(puzzle: PuzzleInput, catalog: Catalog): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const nearMisses: ValidationResult['nearMisses'] = [];
  const ctx = makeRuleContext(catalog);

  // 1. Shape
  const { groups } = puzzle;
  if (groups.length !== 4) {
    errors.push({ code: 'shape.group_count', message: `expected 4 groups, got ${groups.length}` });
  }
  const levels = new Set(groups.map((g) => g.level));
  if (levels.size !== groups.length || [0, 1, 2, 3].some((l) => !levels.has(l as Level))) {
    errors.push({ code: 'shape.levels', message: 'levels 0,1,2,3 must each be used exactly once' });
  }
  const seen = new Set<string>();
  const members = new Map<Level, CatalogProduct[]>();
  for (const g of groups) {
    if (g.productIds.length !== 4) {
      errors.push({ code: 'shape.group_size', message: `group ${g.level} has ${g.productIds.length} items`, level: g.level });
    }
    const list: CatalogProduct[] = [];
    for (const id of g.productIds) {
      if (seen.has(id)) errors.push({ code: 'shape.duplicate_product', message: `product ${id} appears twice`, productId: id });
      seen.add(id);
      const product = ctx.byId.get(id);
      if (!product) errors.push({ code: 'shape.unknown_product', message: `product ${id} not in catalog`, productId: id });
      else list.push(product);
    }
    members.set(g.level, list);
  }
  if (errors.length > 0) return finish(errors, warnings, nearMisses);

  for (const g of groups) {
    if (g.rule.kind === 'curated') continue;
    const inside = members.get(g.level) as CatalogProduct[];
    const insideIds = new Set(inside.map((p) => p.id));

    // 2 + 3. Data availability and membership
    for (const item of inside) {
      const r = evaluateRule(g.rule, item, ctx);
      if (r === 'unknown') {
        errors.push({ code: 'data.missing', message: `${item.id} lacks approved data for group ${g.level}'s rule`, level: g.level, productId: item.id });
      } else if (r === 'no') {
        errors.push({ code: 'membership.fails', message: `${item.id} does not satisfy group ${g.level}'s rule`, level: g.level, productId: item.id });
      }
    }

    // 4. Uniqueness: nobody outside the group may satisfy (or be unverifiable for) its rule
    const relaxed = relaxRule(g.rule);
    for (const other of groups) {
      if (other.level === g.level) continue;
      for (const item of members.get(other.level) as CatalogProduct[]) {
        if (insideIds.has(item.id)) continue;
        const r = evaluateRule(g.rule, item, ctx);
        if (r === 'yes') {
          errors.push({ code: 'uniqueness.ambiguous', message: `${item.id} (group ${other.level}) also satisfies group ${g.level}'s rule`, level: g.level, productId: item.id });
        } else if (r === 'unknown') {
          errors.push({ code: 'uniqueness.unverifiable', message: `no data to prove ${item.id} (group ${other.level}) fails group ${g.level}'s rule`, level: g.level, productId: item.id });
        } else if (relaxed && evaluateRule(relaxed, item, ctx) === 'yes') {
          nearMisses.push({ productId: item.id, level: g.level });
        }
      }
    }
  }
  if (errors.length > 0) return finish(errors, warnings, nearMisses);

  // 5. Red herrings
  if (nearMisses.length < MIN_NEAR_MISSES) {
    warnings.push({ code: 'quality.few_near_misses', message: `only ${nearMisses.length} near misses (want >= ${MIN_NEAR_MISSES})` });
  }

  // 6. Diversity
  const perCategory = new Map<string, number>();
  for (const list of members.values()) for (const p of list) perCategory.set(p.category, (perCategory.get(p.category) ?? 0) + 1);
  for (const [category, count] of perCategory) {
    if (count > MAX_ITEMS_PER_CATEGORY) {
      warnings.push({ code: 'diversity.category_cap', message: `${count} items from category ${category} (max ${MAX_ITEMS_PER_CATEGORY})` });
    }
  }
  if (perCategory.size < MIN_CATEGORIES) {
    warnings.push({ code: 'diversity.category_count', message: `only ${perCategory.size} categories (want >= ${MIN_CATEGORIES})` });
  }

  // 7. Difficulty ordering
  const ordered = [...groups].sort((a, b) => a.level - b.level);
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1] as PuzzleGroupInput;
    const cur = ordered[i] as PuzzleGroupInput;
    if (estimateDifficulty(cur.rule, cur.level) < estimateDifficulty(prev.rule, prev.level) - DIFFICULTY_TOLERANCE) {
      warnings.push({ code: 'difficulty.order', message: `group ${cur.level} looks easier than group ${prev.level}`, level: cur.level });
    }
  }

  return finish(errors, warnings, nearMisses);
}

function finish(
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  nearMisses: ValidationResult['nearMisses'],
): ValidationResult {
  return { ok: errors.length === 0, errors, warnings, nearMisses, score: Math.max(0, 100 - 10 * warnings.length) };
}
