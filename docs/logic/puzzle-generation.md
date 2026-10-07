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
| `theme_tag` | `theme` | hand-tagged association: «تو آشپزخونه لازمه», «مامانم قایمش می‌کرد» (no price) | 0–2 |
| `curated` | `note` | hand-made group; validator skips rule check, relies on human approval | any |

Precise semantics (implemented in `packages/shared/src/puzzle/rules/evaluate.ts`; every evaluator
returns `yes | no | unknown`, `unknown` = the data to decide is missing):

- `same_price_at_year`: `|price - target| * 100 <= target * tolerancePct`, integers only.
- `first_crossed`: judged on recorded points. The first year in the product's data with a price
  above `threshold` must lie in `[fromYear, toYear]` and an earlier point must exist (crossing at
  the very first data point is `unknown`). Never above the threshold => `no`.
- `multiplier_between`: `minX`/`maxX` are positive integers; `priceB` in `[minX*priceA, maxX*priceA]`.
- `cheaper_than_ref`: strictly cheaper; the reference product itself is never a member.
- `category_price_rank`: `rank` = "among the N cheapest" of that category in `year` (1 = cheapest),
  ranked against catalog peers that have a price that year; ties share the better rank.
- `curated`: never machine-judged (always `unknown`).
- Rule money params are integer rials (JSON numbers, zod `int`), never floats.

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

Uniqueness is conservative: if an outside item's data cannot prove it fails a group's rule
(`unknown`), that is a hard error (`uniqueness.unverifiable`), because "exactly one solution" would
be unproven. `curated` groups skip checks 2–3 and are not used as the rule in check 4 (but their
items must still fail every non-curated group's rule). Near misses use a ~30% relaxed rule
(`relaxRule`); difficulty is a rough per-rule heuristic (`estimateDifficulty`) with a 0.1 tolerance.

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

## Hand-built puzzles in the admin panel (D130)

Until the generator exists, the fastest way to get playable puzzles is the admin page «ساخت پازل» (`/admin/puzzles`, permission `content`):
the admin picks **16 distinct catalog products**, splits them into **4 groups of 4** (levels 0–3 once each: yellow, green, blue, purple) and writes
each group's witty title and plain explanation. The puzzle is saved `source: curated`, groups `rule_kind: curated` (no rule is machine-checked,
the admin is the human check) and goes live as `approved` at once; it can be retired and re-activated. The page also shows the catalog's
readiness: products in the catalog, products with ≥ `MIN_PRICE_POINTS_PER_PRODUCT` approved prices, approved puzzles. Prices are not needed to
*play* a puzzle, but the price-guess round and the result chart need approved prices for its products.

## Scheduled pool top-up (D141)

`puzzles/pool.ts`: every `puzzles.autofill_check_minutes` (default 60, first look 45 s after boot; `PUZZLE_SCHEDULER=off` disables it) the server counts
the pool and, when it is below `puzzles.autofill_target` (default 30), generates the gap (at most 20 per run) with the injected RNG. Pool = the **drafts
waiting for a human** by default (`puzzles.autofill_auto_approve` = 0: titles are never auto-published); with auto-approve on, pool = live puzzles and the new
ones are approved at once with the plain-Persian rule as title. `puzzles.autofill_enabled` pauses it. All four are admin settings (group «گیم‌پلی»).

## Generator + admin panel (D131)

`generatePuzzle(catalog, rng, opts)` (`packages/shared/src/puzzle/generate.ts`) is built: hardest level first, rule kinds `multiplier_between` (level 3),
`price_band_at_year` (band ±8 / 15 / 25 / 40 % by level) and `era_icon` (an easy anchor), each instantiated from real prices; the finished puzzle
must pass `validatePuzzle` (one solution) with ≥ 2 near misses. Seeded RNG → same seed, same puzzle. Measured on synthetic catalogs: 150+ products
succeed every time, 90 products ≈ 70 %, 60 ≈ 30 %, so a real catalog of about 150 products with ≥ 3 approved price years each is the target.
All seven machine-checked kinds are now instantiated (see §Generator by player level); the draft titles are varied templates (`draftTitle`).

Admin page «ساخت پازل»: «ساخت خودکار» (`POST /admin/puzzles/generate {count}`) saves up to 20 puzzles as `draft`, `source: generated`; the
placeholder title of each group is the rule in plain Persian (`explainRule`). The admin writes real titles (`PUT /admin/puzzles/:id/titles`) and
approves (`PATCH`); a draft is never served. Generated puzzles never go live without that human step (spec: "Never auto-publish an AI title").


## Generator by player level (owner request 2026-10-07)

`generatePuzzle(catalog, rng, { playerLevel })` takes the level of the players the puzzle is for (`profileForLevel`, `packages/shared/src/puzzle/difficulty.ts`).
Five stages mirror the default tiers (levels 1–3, 4–8, 9–15, 16–25, 26+); a stage sets:

- **`scale`** — multiplies band width, same-price tolerance and the year windows (newcomers looser, veterans tighter; 1.15 → 0.65).
  Newcomers are not given *much* wider bands: wide bands collide and the one-solution check rejects them (measured: 1.5 failed 11 of 12).
- **`minNearMisses`** — red herrings required: 2 for stages 0–2, 3 for stages 3–4.
- **`weights`** — the chance of each rule kind per group level (yellow…purple). Newcomers get era / band / "cheaper than X" / "cheapest of the category";
  `first_crossed` and `multiplier_between` only appear from stage 1/2 up and dominate the purple group for veterans.

Variety: not only "the price was X in year Y". The generator also builds `same_price_at_year` (round targets from real prices), `first_crossed`
(a round threshold such as 1000 تومن between two recorded prices), `cheaper_than_ref` (a low-priced reference product), and `category_price_rank`
(the 4–5 cheapest of a category that year). A kind is used at most twice per puzzle, and a group falls back to the next kind when the chosen one cannot be filled.

Admin «ساخت خودکار» (`POST /admin/puzzles/generate {count, tierId?}`): with a tier it makes every puzzle for that tier's level range (`representativeLevel`),
without one it goes through all tiers in turn, so the pool covers every level. Each draft is tagged with its tier. Draft titles are
`draftTitle(rule)` = a varied opening line + the plain rule (several templates per kind), still drafts for a human to polish; the explanation is the plain rule.
With pool auto-approve on, the title stays the plain rule (no un-reviewed AI wording goes live).

## AI-made puzzles on a schedule (D211)

The AI studio (`docs/logic/ai-studio.md` §Schedules) can also fill the pool: a cron schedule of kind `puzzle_groups` makes whole puzzles with LLM-written titles and saves them as `draft` for the editor. It is independent of the rule-based top-up above; set `puzzles.autofill_enabled` = 0 to rely on the AI schedules only.


### Theme groups (`theme_tag`)

Non-price associations. A product carries the free tag `theme:<key>` (same `product_era_tags` table, no schema change; the era anchor ignores `theme:` tags);
the rule `{ kind: 'theme_tag', theme }` holds when the tag is present. Themes live in `packages/shared/src/puzzle/themes.ts` (key, plain explanation, several draft titles):
آشپزخانه · انباری · تعمیرکار · «مامانم قایم می‌کرد» · کیف مدرسه · جیب بچه‌ها · حمام · سفر · مهمان · کنار خیابان · افطار · صبحانه · بعدازظهر بچه‌ها · کادو · خیابان و جاده · زمستان · خواندنی.
A theme is used only when ≥ 4 products carry it; uniqueness still holds (no outside item may carry the tag), so overlapping tags are fine across themes but
each theme should stay small (≈ 5–16 products). Seeded in `seed/products/sample-bazaar.json` (`era_tags`); the seed loader adds theme tags to already-existing products
too (additive only). More themes = add a `ThemeDef` and tag products (admin or seed). Themes with few products (تعمیرکار) need tool-type products
(آچار، پیچ‌گوشتی، انبردست…) added to the catalog to be rich.
