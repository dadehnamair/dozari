# Economy v2 — sinks, daily habit, keepsake collection («گنجینه»), showcase profile (D204, proposed)

Owner (2026-10-05): the economy should be a thing of value that engages the mind and builds a daily habit, not just "not break".
Audit (D90) says faucets ≈ 14× burn; spending is too thin. Owner approved **all** of the ideas below plus a strong profile that is a source of pride.
Everything here is **proposed**; nothing is built. Numbers go to `packages/shared/src/config/*.ts` (rule 9), never inline.

## Principles

1. Faucets are small, daily and time-gated (habit). Big coin sums come only from skill (human win) and invites.
2. Sinks are things the player *wants*, scale with wealth, and repeat.
3. Target: for an active player, faucet ≈ sink in steady state; median balance plateaus. Verified by the simulator (§Rollout step 1) before any number ships.
4. Two currencies: **coins** (soft, scarce, earned in play, never sold) and **gems / «دای»** (premium, bought with rials, tiny free trickle).
   Coins are **not sold**, directly or via a gem→coin pack (owner). Gems are never withdrawable, never transferable (gifts are coins only), and never a cash prize.
   Real-money flow is a separate gateway decision (owner's own gateway; store policy and legal review needed — see D204).

## Sinks

| # | sink | currency | note |
|---|---|---|---|
| 1 | Stake tiers (D51 made real): bronze / silver / gold tables | coins | e.g. 20 / 100 / 500 entry; richer players climb, the 10 % house cut burns more. Level gate per tier |
| 2 | Daily rotating shop | coins (cheap), gems (premium) | a few limited items, rotates at 00:00 Asia/Tehran; includes **keepsake pieces** |
| 3 | Streak shield | coins (shield), gems (repair a broken streak) | protects the daily-reward / daily-puzzle streak for one missed day |
| 4 | Keepsake collection (below) | coins (upgrade, buy a piece), gems (premium packs) | the main long-term goal |
| 5 | City pot | coins | donate to the player's city treasury; weekly city ranking (uses `cities` config / city chat). Needs a design pass |
| 6 | Season pass | gems | free track for everyone, premium track bought with gems; monthly. Later phase |
| 7 | Gift fee | coins | 5 % of a friend gift is burned (a gift stays a move, the fee is the sink) |
| 8 | Existing | coins | hints, shop tokens, tournament entry, private-table fees |

## Faucets (kept small, capped)

Existing daily reward, daily puzzle, wheel, missions, profile tasks and level coins stay; add a soft **daily cap on non-skill coins** (reward + wheel +
missions + puzzle) so a player cannot out-earn the sinks by only claiming. Skill and invite income are not capped by it. Cap value is a config number.

## Keepsake collection «گنجینه» (the owner's "buy a product piece by piece")

Naming (owner: not «card»): a completed product is a **«یادگار»** (`keepsake`), a part is a **«تکه»** (`piece`), the whole collection is the **«گنجینه»** (`treasury`). Persian words live only in `fa.ts` and DB content; code says `keepsake`. **Art is supplied by the owner's designer**: the app ships text and placeholder frames, a keepsake's `art_key` points at the image when it arrives. Texts (title, story, era) are DB content written by us.

- A **keepsake** is one catalog item (`price-catalog`) in one era. It is split into **N pieces** (proposed N = 4, rarer cards 6).
- Pieces come from: a human win (a drop with a small chance), daily/season rewards, the rotating shop (coins), and gem packs. Duplicates turn into **dust** (a coin sink in reverse: dust funds upgrades).
- Completing a card **adds it to the profile**: it shows the product image, its story and a small price-history chart (reuse `result-chart`), and pays a gem reward.
- Keepsakes belong to **sets**: by decade (1350s … 1400s), by category (bakery, cars, dairy, …). Completing a set gives a title/badge («قهرمان دهه‌۶۰») and a larger reward.
- Rarity by era/obscurity; shown as a frame colour. Pieces are **not tradable** at launch (no gem-for-piece markets, no real-money trading).
- Content comes from the existing catalog + stories (DB content, not i18n). Tables sketch: `keepsake_defs`, `keepsake_pieces`, `user_keepsake_pieces(user, keepsake, piece, count)`, `user_keepsakes(user, keepsake, completed_at)`, `keepsake_sets`. Pieces move through an append-only grant log with idempotency keys, like the ledgers.

## Showcase profile (pride)

The public profile (D67 sheet and the full profile) becomes a shop window:

- **Showcase shelf**: the player pins up to 6 keepsakes; collection completion % and rarest keepsake.
- Level, rank tag, earned badges (existing tags), win record, best streak, price-guess accuracy, **seasons played**, city and city rank, «عضو از روز …» / member number (nostalgia).
- Equipped cosmetics (avatar frame, hat, outfit, back skin) visible to opponents in the match HUD.
- **Shareable profile card** image (growth loop, carries the invite code; same share pipeline as `result-chart`).
- Everything is read-only for others; no coins or gems shown to strangers beyond what the HUD already shows (D39).

## Daily-habit loop

Open → claim reward (streak) → daily puzzle → daily shop rotation → one or two duels → piece drop / season progress → profile grows.
Loss aversion is softened on purpose: the free streak shield exists so the hook never feels punishing.

## Simulation result (step 1, `simulateEconomyV2`, 90 days, 2000 players, seed 7)

Print with `PRINT_ECONOMY=1 pnpm --filter @dozari/shared exec vitest run src/economy/__tests__/simulate-v2.test.ts`.

| economy | median balance day 90 | faucet / sink | stuck |
|---|---|---|---|
| old (bronze only, no cap, no new sinks) | **5216** (rises ≈ 55 a day, never plateaus) | 8.2 | 0 % |
| v2 (tiers + cap + shop + shield + keepsakes) | ≈ 105 (flat from week 1) | 1.02 | 0.05 % |

Reading:
- The old economy inflates much harder over 90 days than the 30-day audit showed (D90). Biggest sources per player over 90 days: free-match wins ≈ 1860, daily reward ≈ 1060, daily puzzle ≈ 700, missions ≈ 630, level coins ≈ 440, bot subsidy ≈ 430.
- The 105 plateau is optimistic: the model has players spend down to a reserve of 3 fees. Sensitivity (`appetite` = how often they use a sink): at 0.5 × appetite the plateau is ≈ 180, at 0.25 × ≈ 650 (free payout 50 %) or ≈ 360 (free payout 25 %). Stakes stay meaningful in all cases and nobody gets stuck (< 0.2 %).
- So the sinks must be **wanted**, with expensive aspirational items (the 350 shop slot, keepsake upgrades, gold table) that give surplus a destination; a thin shop would fall back toward the old curve.
- **Proposal (not applied):** lower `duel.free_payout_percent` 50 → 25 *when the daily shop and keepsakes ship* (not before: today it is the new player's main income). Keep `NON_SKILL_DAILY_CAP` at 40 as a soft ceiling.
- Assumptions that are guesses, to refit from the real ledger after launch: spending appetites, reserve of 3 fees, bot share 25 %, level coins 1.2 per match, mission 60 % × 15.

## Rollout status

1. Simulator — **done** (`simulate-v2.ts`).
2. Stake tables + gift fee — **done** (server, admin settings, mobile chooser; see `economy.md` §Live duel stakes).
3. Streak shield + daily rotating shop — **done** (see `shop.md`; rotation is off until the admin flags items; shield icon is a placeholder).
4. Keepsake collection + showcase profile, 5. city pot + season pass, 6. gem sales — not started.

## Rollout (small phase-scoped PRs)

1. Extend `simulateEconomy` to every faucet and sink above; report median/p10/p90, stuck %, faucet/sink ratio. Tune before building.
2. Stake tiers (D51) + gift fee — mostly config over existing duel stakes.
3. Streak shield + daily rotating shop.
4. Keepsake collection + showcase profile (the large piece: data model, admin editor, art).
5. City pot, season pass.
6. Gem sales via the owner's gateway (separate decision; D170 per-item rials is replaced by gem packs).

## Open questions (owner)

Piece count and drop chances; stake tier sizes; cap on non-skill daily coins; whether duplicates may later be swapped between friends; art for keepsakes (supplied by the owner's designer);
gateway / store policy / legal review before any gem sale.
