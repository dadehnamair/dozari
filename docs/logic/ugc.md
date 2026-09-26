# User-generated content

## Phase 1 — single item / price suggestions

Submission kinds:
- `item`: new product (name, brand, category, unit, photo) + ≥1 price point (year, price, source).
- `price_point`: new price for an existing product.

Flow:
1. User submits (rate limit *UGC_DAILY_LIMIT* = 10). Payload validated by the same zod schemas used by
   seeds (`packages/shared/src/schemas/catalog.ts`). Price entered in **toman or rial** (explicit toggle),
   stored as rials. Year entered as Solar Hijri (2-digit «۷۵» accepted → 1375 for 40–99, 1400+ for 00–39).
2. Duplicate detection: fuzzy match on normalized name (ی/ک normalization, strip spaces/ZWNJ) → suggest
   existing product instead.
3. Community vote: shown to users with ≥ *UGC_VOTER_MIN_MATCHES* = 10 finished matches. Each vote ±1.
4. Auto-state: score ≥ +5 → `ready_for_review`; score ≤ −3 → `rejected`.
5. Admin approves → inserts product/price_point with `status=approved`, `created_by = user`,
   `source_type` from payload, `confidence` 1–2 depending on source evidence. Ledger reward (economy.md).
6. Outlier guard: a price point deviating > 5× from neighbours (same product, adjacent years) is flagged
   for admin even with good votes.

## Phase 2 — full puzzle builder (later)

- Builder picks 16 approved products into 4 groups, sets levels, writes titles.
- Must pass `validatePuzzle` hard checks; groups may use `curated` rule kind → requires admin approval.
- Published community puzzles playable in private tables first, then in queue after quality signals
  (solve rate between 20% and 90%, report rate low).
