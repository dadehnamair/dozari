# Catalog research — template + prompt for a research agent

Goal: an agent researches Iranian products and their **nominal historical prices**, and returns ONE JSON file
that the owner drops into `packages/db/seed/products/` and loads into the DB with two commands (see §Import).
Rules come from the `price-catalog` skill and `packages/shared/src/schemas/catalog.ts` (zod; the importer rejects anything off-schema).

---

## 1. Prompt to give the agent (copy everything in this block)

```text
You are a research agent for «دوزاری», a Persian game about Iranian price nostalgia (players group products by
their historical prices). Your job: RESEARCH (use web search / archives — do not answer from memory alone) and
produce a catalog file of at least 100 NEW products per run, each with price points across the years.

WHAT TO FIND
- Everyday Iranian products/services people remember: food & bread, snacks (پفک، چیپس…), drinks, dairy, cars,
  electronics, digital/telecom (سیم‌کارت، کارت شارژ…), transport (بلیت مترو، تاکسی، بنزین), education, entertainment
  (سینما، بازی ویدیویی، کاست…), clothing, hygiene, services, housing (متری/اجاره), misc.
- Spread across categories and across eras (dahe-40 … dahe-90, 1340–1404). Prefer items with 4+ price years.
- Prices are NOMINAL (the number printed on the tag/ad/receipt that year). NEVER adjust for inflation.
- Prefer sources: newspaper archives (کیهان، اطلاعات، همشهری)، official price lists (مصوبه‌ها، تعرفه‌ها)، Wikipedia
  fa/en, old ads, forums/blogs with photos, digikala/torob history (for recent years).
- Target years if available: 1365, 1370, 1375, 1380, 1385, 1390, 1395, 1400 (any other years are fine too).
  Minimum 3 price years per product; the more the better.
- Existing products: see the "ALREADY IN THE CATALOG" block below. (`sample-*` slugs are placeholders with rough prices;
  you MAY re-create such a product with real researched data under the same name but WITHOUT the `sample-` prefix.)

ALREADY IN THE CATALOG — DO NOT DUPLICATE
The owner pastes the existing products below (slug — name_fa). Treat a product as a duplicate if the slug matches OR the
same real-world item/brand/unit appears under a different spelling (e.g. «نان سنگک» = «سنگک»). Skip duplicates entirely;
find other products instead. Your 100+ products must all be new. If this block is empty, fall back to reading
packages/db/seed/products/*.json (ignore `sample-*`).
<<<EXISTING_PRODUCTS_START
(paste here, one per line:  slug — نام محصول)
EXISTING_PRODUCTS_END>>>
Also keep a running list of what you add, so you never repeat a product inside your own file.

HARD RULES
1. Output is ONE valid JSON array (UTF-8, no comments, no trailing commas), file name `<yyyymmdd>-<topic>.json`.
2. Every price states its unit explicitly: use "toman": N  OR  "rials": N (exactly one). 1 toman = 10 rials. Integers only
   (5 rials = "rials": 5, never "toman": 0.5 — use rials for sub-toman values).
3. Years are Solar Hijri integers (1375). If a source gives a Gregorian year, use year-621 and say so in source_note.
4. The unit of a product must be the same across all its price points (unit_fa: «یک عدد»، «یک کیلو»، «یک لیتر»، «یک بسته 500 گرمی»…).
   Do not mix per-kg and per-pack.
5. Sanity-check: nominal prices almost always rise. A drop >30% vs previous year, or a jump >5× in one year, is probably a
   rial/toman mistake: re-check, or drop that point.
6. NEVER invent a price. If you cannot find or reasonably derive a number, omit that year. Estimates/interpolations are
   allowed ONLY marked as status "pending" + confidence 1 + source_note starting with "تخمین:".
7. Every price needs source_type, a source_note (Persian, short: where exactly), confidence, and ideally source_url.
8. Redenomination: if a source quotes "new toman" (4 zeros dropped), convert to old rials (×10 000) and mention it in source_note.

OUTPUT — an array of objects with EXACTLY these fields (no extra fields; unknown fields fail validation):
[
  {
    "slug": "ascii-kebab-case-unique",            // lowercase a-z0-9 and hyphens only, e.g. "pofak-namaki"
    "name_fa": "پفک نمکی",                         // required
    "brand": "مینو",                               // optional
    "category": "snack",                           // one of: car food snack drink digital electronics housing transport
                                                   //         education entertainment clothing hygiene service other
    "unit_fa": "یک بسته",                          // required in practice (see rule 4)
    "icon_key": "pofak",                           // optional; must exist in packages/shared/src/items/data.ts, else OMIT it
    "audience": ["kids", "family"],                // any of: kids teens adults elderly family
    "era_tags": ["dahe-70", "dahe-80"],            // decades of peak nostalgia: dahe-40 … dahe-90
    "story_fa": "یک تا دو جمله‌ی خاطره‌انگیز و بی‌ادعا به فارسی",   // optional, no made-up facts
    "status": "in_production",                     // in_production | discontinued | changed
    "prices": [                                    // at least 1; aim for >= 3 distinct years
      {
        "year": 1375,
        "toman": 150,                              // OR "rials": 1500 — exactly one
        "source_type": "archive_newspaper",        // archive_newspaper | official_list | receipt_photo | website | user_memory | other
        "source_url": "https://…",                 // optional, must be a valid URL
        "source_note": "آگهی روزنامه همشهری، مهر ۱۳۷۵",
        "confidence": 3,                           // 3 = real citation found, 2 = secondary/consistent sources, 1 = weak/estimate
        "status": "approved"                       // approved only with a real citation (confidence 2-3); otherwise "pending"
      }
    ]
  }
]
Optional per price: "month": 1-12. Never two approved prices for the same (year, month).
user_memory prices must have confidence 1.

BEFORE YOU FINISH
- Validate: JSON parses; ≥100 products; every slug unique and not already in the repo; every product ≥3 price years
  (explain any exception); no field outside the list above.
- If you have shell access in the repo: copy the file to packages/db/seed/products/ and run
  `pnpm --filter @dozari/db seed:check` — it must print "seed ok". Fix every reported problem. Do NOT run `seed` itself.
- Reply with: file path, number of products, number of price points, count of approved vs pending, and a short list of
  products you were unsure about.
```

---

## 2. Import (owner, ~1 minute)

1. Put the file(s) in `packages/db/seed/products/` (any `*.json`; every file in the folder is loaded).
2. Validate: `pnpm --filter @dozari/db seed:check` → `seed ok: N products …`
3. Load (idempotent, insert-only — existing rows matched by `slug` and `(slug, year, month)` are left untouched): `pnpm --filter @dozari/db seed`
   - **Inside the production container** the `pnpm … seed` script fails (`../../.env: not found`: the env is already injected, there is no .env file).
     Run the runner directly: `cd /app/packages/db && pnpm exec tsx src/seed/run.ts --check`, then `pnpm exec tsx src/seed/run.ts`.
     The new JSON must exist inside the image: `git pull` on the host, then `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build`
     (with `SEED_ON_START=1` the seed service loads it automatically), or `docker cp file.json c-dozari-server:/app/packages/db/seed/products/`.
   - On the production host, see `docs/deploy.md` §seed (`SEED_ON_START=1` re-runs the seed on every `up -d --build`;
     the default `empty` mode only seeds an empty DB).
   - Remove placeholder data once real data is in: `pnpm --filter @dozari/db seed:remove-sample`.
4. Prices with `"status": "pending"` do not appear in puzzles until approved on the admin review page (`/admin`, token-guarded):
   approve / reject / re-queue, with automatic flags for >30% drops and >5× jumps. Only `approved` points are used by the generator.

Icons: `icon_key` is optional; products without one just show no illustration. Product photos are separate
(`packages/db/seed/images` + `images:upload`) and not needed for this task.

## 3. Review checklist for the owner

- Spot-check 10 random prices against their `source_url`.
- Look for unit errors (rial vs toman is the #1 mistake) and mixed units per product.
- Coverage: every product ≥3 approved years, ideally spread over 1365–1400, so the generator can build puzzles.

## 4. Getting the existing-products list (to paste into the prompt)

```bash
# from the seed files
node -e "for (const f of require('fs').readdirSync('packages/db/seed/products').filter(f=>f.endsWith('.json'))) for (const p of require('./packages/db/seed/products/'+f)) console.log(p.slug+' — '+p.name_fa)"
```
Products added only via the admin panel are not in the files; export them from MySQL if needed:
`SELECT slug, name_fa FROM products;`
