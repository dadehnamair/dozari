# Data model (MySQL 8, Drizzle)

Conventions: `id char(36)` (UUID v7, app-generated) PK, `created_at/updated_at datetime(3)` holding UTC, snake_case columns,
money = `bigint` rials, years = `smallint` Solar Hijri.
**No JSON columns and no array columns** (owner decision, D63): multi-valued data gets its own table.
Spec sections below that still say `jsonb` / `text[]` for *later* phases must be normalised into tables
when they are built.

## Catalog

### `products` — identity (static)
| column | type | notes |
|---|---|---|
| id | uuid | |
| slug | text unique | ascii, stable, used by seeds (`peykan-javanan`) |
| name_fa | text | display name |
| icon | varchar(16) null | emoji stand-in for a product photo (puzzle tiles); content, not UI chrome |
| brand | text null | manufacturer / brand |
| category | enum `product_category` | `car, food, snack, drink, digital, electronics, housing, transport, education, entertainment, clothing, hygiene, service, other` |
| unit_fa | text null | «یک کیلو»، «یک بسته»، «یک عدد»، «متر مربع» — price is for this unit |
| story_fa | text null | memory / fun fact shown after match |
| status | enum | `in_production, discontinued, changed` |
| is_active | boolean | usable by generator |
| created_by | uuid null | user id if from UGC |

### `product_audiences`
`product_id FK, audience enum(kids|teens|adults|elderly|family)` — PK (product_id, audience).

### `product_era_tags`
`product_id FK, tag varchar` (e.g. `dahe-60`, decade of peak nostalgia) — PK (product_id, tag).

### `product_images`
`id, product_id FK, url, year_from smallint null, year_to smallint null, is_primary bool, credit text null`
(Brief: "multiple photos from different eras.")

### `price_points` — time series (1:N)
| column | type | notes |
|---|---|---|
| id | uuid | |
| product_id | uuid FK | |
| year | smallint | Solar Hijri, e.g. 1375 |
| month | smallint null | 1–12 if known |
| price_rials | bigint | **nominal**, integer rials, > 0 |
| source_type | enum | `archive_newspaper, official_list, receipt_photo, website, user_memory, other` |
| source_url | text null | |
| source_note | text null | |
| confidence | smallint | 1 (memory) … 3 (documented) |
| status | enum | `approved, pending, rejected` |

Unique `(product_id, year, month)` among approved rows: MySQL has no partial index, so a stored generated column
`approved_flag = IF(status='approved',1,NULL)` is part of the unique key (NULLs never collide). A NULL `month`
is distinct in unique keys, so the seed loader matches month-less rows manually. Generator uses only `approved`.

**Price at year Y** (`priceAt(product, Y)`): exact approved point for Y; if several months, the
median. No interpolation for gameplay rules (interpolation allowed only for chart smoothing, flagged).

## Puzzles

### `puzzles`
`id, slug varchar null unique (seeded puzzles), status (draft|approved|retired), source (generated|curated|ugc), author_id null, seed bigint null,
difficulty_score real, times_played int, avg_solve_rate real, created_at`

### `puzzle_groups`
`id, puzzle_id FK, level smallint (0=yellow,1=green,2=blue,3=purple), title_fa text,
rule_* columns (see below), explanation_fa text` — exactly 4 per puzzle, unique `(puzzle_id, level)`.

No JSON (D63): the rule from puzzle-generation.md is flattened into `rule_kind` (enum) + nullable
`rule_era_tag, rule_year, rule_year_to, rule_min_rials, rule_max_rials, rule_target_rials,
rule_threshold_rials, rule_tolerance_pct, rule_min_multiplier`. `rule_year` = the (first) year;
`rule_year_to` = `first_crossed.to` / `multiplier_between.year_b`. Money columns are integer rials.

### `puzzle_group_items`
`group_id FK, product_id FK, display_year smallint null` — exactly 4 per group, 16 distinct products per puzzle.
`display_year` is used when the item card shows a year hint (some rule types).

### `group_title_templates`
`id, rule_kind, title_fa, tone (funny|nostalgic|neutral), min_level, max_level, is_active`
Human/AI-written witty titles, matched to rule kinds.

## Users & social

### `users`
`id, device_id unique null, phone text unique null, nickname text, avatar_key text,
chat_unlocked_at timestamptz null, invited_by uuid null, is_banned bool, created_at, last_seen_at`

### `invite_codes`
`code text PK (6 chars, no ambiguous chars), owner_id FK, max_uses int, uses int, created_at`
### `invite_redemptions`
`code FK, redeemer_id FK unique, redeemed_at, reward_status (pending|granted|void)`

### `canned_taunts`
`id, text_fa, category (greeting|brag|tease|gg|react), is_active`

### `chat_messages` (retained 30 days)
`id, match_id, sender_id, channel (team|all), kind (taunt|text), taunt_id null, text null, flagged bool, created_at`
### `reports`, `mutes` — standard.

## Matches

### `matches`
`id, mode (duel|team|private), puzzle_id, status (waiting|active|finished|aborted), entry_fee int,
room_code text null, started_at, ended_at, winner_side smallint null`
### `match_players`
`match_id, user_id, side smallint (0|1), seat smallint, score int, result (win|loss|draw|abandon) null`
### `match_events` (append-only log for replay/debug)
`match_id, seq int, type text, payload jsonb, at timestamptz` — PK (match_id, seq).

## Economy

### `coin_ledger` (append-only, never updated/deleted)
| column | notes |
|---|---|
| id | |
| user_id | |
| delta | int, +/- |
| reason | enum: `signup_bonus, daily_login, match_entry, match_payout, match_refund, invite_reward, ugc_reward, admin_adjust, purchase, bot_match_subsidy, price_guess_wager, price_guess_payout` |
| ref_type / ref_id | e.g. `match`/uuid |
| idempotency_key | text unique — e.g. `match_payout:<matchId>:<userId>` |
| created_at | |

Balance = `SUM(delta)`; cached in `user_balances` materialized by trigger or updated in the same
transaction. A check constraint / service guard prevents balance < 0.

### `coin_packages` (IAP catalog — designed now, not enabled at MVP; `economy.md` §Real-money coin purchases)
`id, coins, price_irr, store_sku_bazaar, store_sku_myket, is_active` — a fixed handful of tiers,
never a free-form amount. Purchases verified server-side against the store's receipt API before
any `purchase` ledger row is written.

## UGC
`ugc_submissions(id, user_id, kind (item|price_point|puzzle), payload jsonb, status (pending|approved|rejected), reviewer_id, created_at)`
`ugc_votes(submission_id, user_id, vote smallint (-1|1))` PK (submission_id, user_id).
