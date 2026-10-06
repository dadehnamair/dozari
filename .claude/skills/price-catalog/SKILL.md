---
name: price-catalog
description: Add, import, correct, or review products and historical price points in the catalog (Iranian nostalgic prices). Use for seed data, rial/toman conversion, Solar Hijri years, price sources/confidence, product images, UGC item approval, or any request like «محصول اضافه کن» / «قیمت‌ها رو وارد کن».
---

# Price catalog

Spec: `docs/logic/data-model.md` (§Catalog). Decisions D5, D6 in `docs/DECISIONS.md`.

## Units — get this right

- Store `price_rials` as integer (BIGINT). **1 toman = 10 rials.** Display in toman.
- Input from humans is usually toman («۱۰۰ تومن») → multiply by 10. Always make the unit explicit in
  seed files (`"price": {"toman": 100}` or `{"rials": 1000}`), never a bare number.
- Very old prices can be fractional toman (e.g. 5 ریال = ۰٫۵ تومان) — that's why we store rials.
- **Redenomination:** Iran's plan to drop 4 zeros ("new toman" = 10,000 rials). All stored data stays in
  *old* rials. If a source quotes a post-redenomination price, convert: `rials = newToman * 10_000` and
  note it in `source_note`. Display always uses old toman unless a product decision says otherwise.
- **Nominal only** — never adjust for inflation, never "normalize" to today's money.

## Years

- Solar Hijri integer (`1375`). Two-digit inputs: 40–99 → 13xx, 00–39 → 14xx.
- If only a Gregorian year is known, convert to the Solar Hijri year covering most of it (Gregorian − 621)
  and set `month` null; mention in `source_note`.

## Seed file format (`packages/db/seed/products/<category>.json`)

```json
{
  "slug": "peykan-javanan",
  "name_fa": "پیکان جوانان",
  "brand": "ایران خودرو",
  "category": "car",
  "unit_fa": "یک دستگاه",
  "audience": ["adults", "family"],
  "era_tags": ["dahe-50", "dahe-60"],
  "story_fa": "…",
  "status": "discontinued",
  "images": [{"file": "peykan-1360.jpg", "year_from": 1355, "year_to": 1370, "is_primary": true}],
  "prices": [
    {"year": 1357, "toman": 30000, "source_type": "archive_newspaper", "source_note": "آگهی کیهان", "confidence": 3}
  ]
}
```

Validated by zod (`packages/shared/src/schemas/catalog.ts`); seed is idempotent and insert-only by `slug` + `(slug, year, month)`: existing products/prices (admin edits) are never overwritten.

## Quality checks before adding prices

- Monotonic-ish: nominal prices in Iran almost always rise; a drop > 30% vs previous year → double-check
  (possible unit mistake rial↔toman, the #1 error).
- Neighbour ratio > 5× in one year → flag (except known shock years, e.g. currency jumps 1391, 1397, 1401).
- Unit consistency: same `unit_fa` across all points (per kg vs per pack!).
- Every point needs `source_type`; `user_memory` → confidence 1. Don't invent prices: if unsure, leave the
  point out and add a TODO in `source_note` of a draft rather than guessing. Clearly mark any
  AI-suggested/estimated value as `status: "pending"` for human verification.

## Bootstrap sourcing (owner-approved, 2026-09-27)

Before UGC (`docs/logic/ugc.md`) is live to carry the load, fill the initial catalog from two
sources, both allowed:

1. **Manual/AI-assisted research** over newspaper archives and old websites — `source_type:
   archive_newspaper` or `website`, `confidence: 3` when a real citation is found. An AI research
   pass may *suggest* a price, but never insert it directly: land it as `status: "pending"` with
   the suggestion noted in `source_note`, for a human to verify before it flips to `approved`
   (same rule as the "Quality checks" section above — don't invent prices).
2. **Personal/family memories** — the owner's and acquaintances' own recollections,
   `source_type: user_memory`, `confidence: 1`. Fine for bootstrapping tone and coverage; these
   are exactly the kind of point a later UGC vote or a stronger source should be able to upgrade.

## Useful puzzle coverage

Generator needs dense years. Prioritize filling 1365, 1370, 1375, 1380, 1385, 1390, 1395, 1400 for every
product. Run `pnpm --filter db catalog:coverage` (to be built in Phase 1) to see gaps.
