import { type CatalogProduct, type Rule, hasDataFor, relax, satisfies } from './rules.js';

export interface PuzzleGroup {
  level: number;
  rule: Rule;
  /** Catalog product ids. */
  items: readonly string[];
}
export interface PuzzleDraft {
  groups: readonly PuzzleGroup[];
}

export interface ValidationResult {
  /** Hard checks 1–4 all pass: safe to save/serve. */
  ok: boolean;
  errors: string[];
  /** Soft checks 5–7: quality warnings, they don't block saving. */
  warnings: string[];
  /** Items outside a group that satisfy a relaxed version of its rule. */
  nearMisses: number;
}

export const MIN_NEAR_MISSES = 2;
export const MAX_ITEMS_PER_CATEGORY = 6;
export const MIN_CATEGORIES = 3;

/**
 * `validatePuzzle` — docs/logic/puzzle-generation.md §Validation.
 * Hard: shape, data availability, membership, uniqueness. Soft: near misses, diversity.
 * (Soft check 7, difficulty ordering, needs a difficulty estimator and is not implemented yet.)
 * `curated` groups skip membership/uniqueness: a human approves them.
 */
export function validatePuzzle(
  puzzle: PuzzleDraft,
  catalog: ReadonlyMap<string, CatalogProduct>,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const all = puzzle.groups.flatMap((g) => g.items);

  // 1. Shape
  const levels = puzzle.groups.map((g) => g.level).sort();
  if (puzzle.groups.length !== 4 || levels.join() !== '0,1,2,3') {
    errors.push('shape: need exactly 4 groups with levels 0,1,2,3');
  }
  if (puzzle.groups.some((g) => g.items.length !== 4))
    errors.push('shape: every group needs 4 items');
  if (new Set(all).size !== all.length || all.length !== 16) {
    errors.push('shape: need 16 distinct products');
  }
  const products: CatalogProduct[] = [];
  for (const id of all) {
    const p = catalog.get(id);
    if (p) products.push(p);
    else errors.push(`unknown product: ${id}`);
  }
  if (errors.length > 0) return { ok: false, errors, warnings, nearMisses: 0 };

  const byId = (id: string) => catalog.get(id) as CatalogProduct;

  // 2. Data availability, 3. membership
  for (const g of puzzle.groups) {
    if (g.rule.kind === 'curated') continue;
    for (const id of g.items) {
      const p = byId(id);
      if (!hasDataFor(g.rule, p))
        errors.push(`data: ${id} lacks approved prices for level ${g.level} rule`);
      else if (!satisfies(g.rule, p))
        errors.push(`membership: ${id} fails its level ${g.level} rule`);
    }
  }

  // 4. Uniqueness: no outsider satisfies a group's rule
  for (const g of puzzle.groups) {
    if (g.rule.kind === 'curated') continue;
    for (const id of all) {
      if (!g.items.includes(id) && satisfies(g.rule, byId(id))) {
        errors.push(`uniqueness: ${id} also satisfies level ${g.level} rule`);
      }
    }
  }

  // 5. Red herrings (soft)
  let nearMisses = 0;
  for (const g of puzzle.groups) {
    if (g.rule.kind === 'curated') continue;
    const relaxed = relax(g.rule);
    for (const id of all) if (!g.items.includes(id) && satisfies(relaxed, byId(id))) nearMisses++;
  }
  if (nearMisses < MIN_NEAR_MISSES) {
    warnings.push(`red herrings: only ${nearMisses} near misses (want >= ${MIN_NEAR_MISSES})`);
  }

  // 6. Diversity (soft)
  const perCategory = new Map<string, number>();
  for (const p of products) perCategory.set(p.category, (perCategory.get(p.category) ?? 0) + 1);
  if (perCategory.size < MIN_CATEGORIES)
    warnings.push(`diversity: only ${perCategory.size} categories`);
  for (const [c, n] of perCategory) {
    if (n > MAX_ITEMS_PER_CATEGORY) warnings.push(`diversity: ${n} items from category ${c}`);
  }

  return { ok: errors.length === 0, errors, warnings, nearMisses };
}
