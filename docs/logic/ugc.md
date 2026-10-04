# User-generated content

## Phase 1 — single item / price suggestions

Submission kinds:
- `item`: new product (name, brand, category, unit, photo) + ≥1 price point (year, price, source).
- `price_point`: new price for an existing product.

### Submission form fields (owner-approved, 2026-09-27)

Reached from its own Home-screen card (`app-screens.md`). Fields:

1. **Item name** + **photo** — from the device gallery or camera (`expo-image-picker`).
2. **Year** + **price**, with an explicit toman/rial toggle (stored as rials per D5).
3. **Source/evidence** — one of: a URL, a photo (e.g. a receipt), or free text (e.g. «یادمه» /
   "I remember") — `source_type` maps to `website`/`receipt_photo`/`user_memory` respectively
   (`data-model.md` §price_points), `confidence` defaults lower for the text-memory case.
4. **Category/unit** — same enum as the catalog (`data-model.md` §products: `product_category`,
   `unit_fa`).

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

### Voting feed UI (owner-approved, 2026-09-27)

A **single-card swipe feed**, Instagram-Stories-style: one pending submission at a time (photo,
name, year, price, source), with two actions — **approve** (👍) or **reject** (👎) — instead of a
scrollable list. Advancing to the next card is automatic after a vote. Simpler to build and keeps
voting fast/low-friction for the ≥10-match voter pool in step 3 above.

## Phase 2 — full puzzle builder (later)

- Builder picks 16 approved products into 4 groups, sets levels, writes titles.
- Must pass `validatePuzzle` hard checks; groups may use `curated` rule kind → requires admin approval.
- Published community puzzles playable in private tables first, then in queue after quality signals
  (solve rate between 20% and 90%, report rate low).

## Built (D177)

Submission kinds `item`, `price_point`, `price_report`; votes; admin approve/reject (admin pages «پیشنهاد قیمت و کالا», «گزارش بازیکن‌ها»); ledger reward `ugc_reward`; settings `ugc.*`, `report.daily_limit`. Missing: photo, outlier guard.
