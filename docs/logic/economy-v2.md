# Economy v2 — sinks, daily habit, collection cards, showcase profile (D204, proposed)

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
| 2 | Daily rotating shop | coins (cheap), gems (premium) | a few limited items, rotates at 00:00 Asia/Tehran; includes **card pieces** |
| 3 | Streak shield | coins (shield), gems (repair a broken streak) | protects the daily-reward / daily-puzzle streak for one missed day |
| 4 | Collection cards (below) | coins (upgrade, buy a piece), gems (premium packs) | the main long-term goal |
| 5 | City pot | coins | donate to the player's city treasury; weekly city ranking (uses `cities` config / city chat). Needs a design pass |
| 6 | Season pass | gems | free track for everyone, premium track bought with gems; monthly. Later phase |
| 7 | Gift fee | coins | 5 % of a friend gift is burned (a gift stays a move, the fee is the sink) |
| 8 | Existing | coins | hints, shop tokens, tournament entry, private-table fees |

## Faucets (kept small, capped)

Existing daily reward, daily puzzle, wheel, missions, profile tasks and level coins stay; add a soft **daily cap on non-skill coins** (reward + wheel +
missions + puzzle) so a player cannot out-earn the sinks by only claiming. Skill and invite income are not capped by it. Cap value is a config number.

## Collection cards (the owner's "buy a product piece by piece")

- A **product card** is one catalog item (`price-catalog`) in one era. It is split into **N pieces** (proposed N = 4, rarer cards 6).
- Pieces come from: a human win (a drop with a small chance), daily/season rewards, the rotating shop (coins), and gem packs. Duplicates turn into **dust** (a coin sink in reverse: dust funds upgrades).
- Completing a card **adds it to the profile**: it shows the product image, its story and a small price-history chart (reuse `result-chart`), and pays a gem reward.
- Cards belong to **sets**: by decade (1350s … 1400s), by category (bakery, cars, dairy, …). Completing a set gives a title/badge («قهرمان دهه‌۶۰») and a larger reward.
- Rarity by era/obscurity; shown as a frame colour. Pieces are **not tradable** at launch (no gem-for-piece markets, no real-money trading).
- Content comes from the existing catalog + stories (DB content, not i18n). Tables sketch: `card_defs`, `card_pieces`, `user_card_pieces(user, card, piece, count)`, `user_cards(user, card, completed_at)`, `card_sets`. Pieces move through an append-only grant log with idempotency keys, like the ledgers.

## Showcase profile (pride)

The public profile (D67 sheet and the full profile) becomes a shop window:

- **Showcase shelf**: the player pins up to 6 completed cards; collection completion % and rarest card.
- Level, rank tag, earned badges (existing tags), win record, best streak, price-guess accuracy, **seasons played**, city and city rank, «عضو از روز …» / member number (nostalgia).
- Equipped cosmetics (avatar frame, hat, outfit, card back) visible to opponents in the match HUD.
- **Shareable profile card** image (growth loop, carries the invite code; same share pipeline as `result-chart`).
- Everything is read-only for others; no coins or gems shown to strangers beyond what the HUD already shows (D39).

## Daily-habit loop

Open → claim reward (streak) → daily puzzle → daily shop rotation → one or two duels → piece drop / season progress → profile grows.
Loss aversion is softened on purpose: the free streak shield exists so the hook never feels punishing.

## Rollout (small phase-scoped PRs)

1. Extend `simulateEconomy` to every faucet and sink above; report median/p10/p90, stuck %, faucet/sink ratio. Tune before building.
2. Stake tiers (D51) + gift fee — mostly config over existing duel stakes.
3. Streak shield + daily rotating shop.
4. Collection cards + showcase profile (the large piece: data model, admin editor, art).
5. City pot, season pass.
6. Gem sales via the owner's gateway (separate decision; D170 per-item rials is replaced by gem packs).

## Open questions (owner)

Piece count and drop chances; stake tier sizes; cap on non-skill daily coins; whether duplicates may later be swapped between friends; art budget for card images;
gateway / store policy / legal review before any gem sale.
