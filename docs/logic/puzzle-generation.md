# Puzzle structure, rules, generation & validation

## Structure

- 16 distinct products, 4 groups × 4.
- Groups have a **level**: 0 yellow (easiest) → 1 green → 2 blue → 3 purple (hardest).
- Each group has:
  - `rule` — an objective, machine-checkable predicate over catalog data (what makes it correct).
  - `title_fa` — the **indirect, humorous** title revealed on solve (brief: «چیزهایی که مامان‌بزرگ‌ها ازشون شاکی‌ان»).
  - `explanation_fa` — one line revealed with the title that states the actual rule plainly
    («همه‌شون سال ۷۵ حدود ۱۰۰ تومن بودن»).

Title is flavor; the rule is what the validator guarantees. Players should be able to deduce groups
from price knowledge + reasoning, not by guessing the author's joke.

## Rule types (`rule.kind`)

All price comparisons use `priceAt(product, year)` (nominal rials). Bands are inclusive, stored in rials.

| kind | params | meaning | typical level |
|---|---|---|---|
| `price_band_at_year` | `year, min, max` | "cost ~100 toman in 1375" | 0–2 (narrower band = harder) |
| `same_price_at_year` | `year, target, tolerancePct` | "all were exactly/about X in year Y" | 1–3 |
| `first_crossed` | `threshold, fromYear, toYear` | "first went over 1000 toman in the 80s" | 2–3 |
| `multiplier_between` | `yearA, yearB, minX, maxX` | "became ~100× more expensive from 1370 to 1400" | 3 |
| `cheaper_than_ref` | `year, refProductId` | "in 1380 each was cheaper than a Peykan tire" | 2–3 |
| `era_icon` | `eraTag` | "stars of the 60s" (non-price, easy anchor) | 0 |
| `category_price_rank` | `year, category, rank` | "the cheapest snacks of 1370" | 1–2 |
| `curated` | `note` | hand-made group; validator skips rule check, relies on human approval | any |

Add new kinds only together with: evaluator in `packages/shared/src/puzzle/rules/`, unit tests,
and a row in this table.

## Validation (`validatePuzzle(puzzle, catalog) → ValidationResult`)

A puzzle is valid iff ALL hold:

1. **Shape:** exactly 4 groups, levels {0,1,2,3} each used once, 4 items per group, 16 distinct products.
2. **Data availability:** every item has an approved price point for every year its group rule references.
3. **Membership:** each item satisfies its own group's rule.
4. **Uniqueness (the critical one):** for every group G and every item X *not* in G,
   X does **not** satisfy G's rule. → No item can legitimately be placed in two groups, so there is
   exactly one solution. (For `curated` groups this check is skipped and `status` must be set to
   approved by a human.)
5. **Red herrings (quality, soft):** at least 2 cross-group "near misses" exist (an item that
   satisfies a *relaxed* version of another group's rule, e.g. band widened by 30%). Puzzles with zero
   near misses are too easy → reject in generator, warn for curated.
6. **Diversity (soft):** ≤ 6 items from any single `category`; ≥ 3 categories total.
7. **Difficulty ordering (soft):** estimated difficulty of levels is non-decreasing.

Hard failures (1–4) block saving. Soft failures (5–7) are warnings with a score penalty.

## Generator (`generatePuzzle(catalog, rng, opts)`)

Template-driven with retries (seeded RNG → reproducible; store `seed` on the puzzle):

```
for attempt in 1..MAX_ATTEMPTS:
  used = {}
  groups = []
  for level in [3, 2, 1, 0]:              # hardest first: most constrained
    kind  = pickRuleKind(level, rng)
    rule  = instantiateRule(kind, catalog, rng)        # choose year/band/threshold from data
    cands = catalog.filter(p => !used.has(p) && satisfies(rule, p))
    if cands.length < 4: continue outer
    pick 4 from cands (prefer high-nostalgia, image available, category diversity)
    groups.push({level, rule, items})
    used += items
  if validatePuzzle(groups).hardOk and nearMisses >= 2:
    attach titles (group_title_templates by rule.kind & level, random, avoid recent repeats)
    return puzzle
throw GenerationFailed
```

Choosing bands: pick a year with dense data, pick a target price from actual prices in that year,
band = target ± k% where k shrinks with level (yellow 40%, green 25%, blue 15%, purple 8%).
Always re-run the uniqueness check — narrowing bands is how collisions are avoided.

## Content bootstrap order (owner-approved, 2026-09-27)

Before the automated generator is trusted to run unattended:

1. **Hand-curate `MANUAL_PUZZLE_TARGET`** = 50–100 high-quality puzzles first (`curated` groups
   allowed, admin-approved) — this is what sets the game's tone/humor bar. The automated
   generator in §Generator is built and tuned to imitate this style, not the other way around.
2. Only after that pool exists does the generator's output get trusted into the `approved` pool
   without a human pass — see `PLAN.md` Phase 2 ordering.

### Group titles: AI-drafted, owner-approved

Titles (`title_fa`) are **drafted by an LLM** from the group's `rule` (a prompt template per rule
`kind`, producing 2–3 candidate titles in the tone described in `puzzle-design.md`), then a human
**picks/edits** one before the puzzle is saved as `approved`. Never auto-publish an AI title
un-reviewed — this is a content-quality gate, same spirit as the `curated` rule kind's
human-approval requirement above. Track candidate titles + which was chosen in
`group_title_templates` so good drafts get reused and bad ones don't repeat.

## "Infinite" puzzles

- A background job keeps a pool of ≥ `POOL_MIN` approved puzzles (config) and tops it up.
- Generated puzzles default to `approved` only if every group title came from an approved template;
  otherwise `draft` for admin review.
- A player should not see the same puzzle twice: `user_seen_puzzles(user_id, puzzle_id)`; matchmaking
  picks a puzzle none of the match participants has seen (fallback: least-recently seen).
- Track `avg_solve_rate` per group to recalibrate difficulty over time.

## Board presentation

- Item card: primary image (era-appropriate if the rule references a year), `name_fa`, optional
  `unit_fa`. **No prices shown during play.**
- Initial order: seeded shuffle; guarantee no row of the initial grid equals a full group.
