# Coin shop and solo hints (owner backlog items 1, 3, 4)

Owner (2026-10-01): sell items for coins, hints in solo games with rules set from the admin panel, and coins must feel
**valuable** both ways — earning and spending. Everything below is tunable from the admin panel (settings registry + «فروشگاه»).

## Coin value principle (item 4)

Coins are scarce on purpose. Faucets stay small and bounded (see `economy.md`), every sink shows its price and its rule
*before* the tap, and nothing is sold for coins that a player could not feel the cost of. When adding a faucet or a sink,
update `economy.md` and run the balance simulation. Real-money coin packages stay built-but-off (`economy.md` §IAP).

## Solo hints (item 1)

Server-authoritative (`apps/server/src/solo/hints.ts`, pure picking in `packages/shared/src/economy/hints.ts`).

| hint | reveals | default price |
|---|---|---|
| `group_title` | the name of the easiest unsolved group | 15 |
| `one_card` | one card of the easiest unsolved group | 20 |
| `pair` | two cards of the same group | 35 |

Rules (all settings `hint.*`): level ≥ `hint.min_level` (2), at most `hint.max_per_game` (2) per game, the 2nd and later cost
`hint.repeat_percent` % of the listed price (200). A card or title already revealed is never repeated; when nothing new is left the
request is refused **before** charging. Payment: a **hint token** if the player owns one, otherwise coins
(`hint_purchase`, key `hint_purchase:<session>:<n>:<user>` so a retry never double-charges). Only the owner of a signed-in game may
take hints; anonymous games and finished games cannot. Hints exist only in solo practice — never in duels.

## Shop (item 3)

`shop_items` (title, description, effect, amount, `price_coins`, `min_level`, `per_day_limit`, active), `user_inventory`
(qty per effect), `shop_purchases` (audit + daily-limit count). Only effect today: `hint_token` (+N tokens per purchase).
A purchase is one transaction: ledger debit `shop_purchase` + inventory grant + purchase row; a daily limit hit rolls it back.
Daily limits reset at 00:00 Asia/Tehran. Two starter items are created on first use (1 token for 20, 5 tokens for 80 from level 3,
max 3 packs a day) — edit or hide them in the admin panel. The player sees the level gate, the daily limit and "not enough coins"
on the item before buying.

**Character items live in the fitting room, not here (D179).** `effect = cosmetic` rows (hat, hair, glasses, outfit,
accessory) are still `shop_items` priced in the admin panel — free (0), coins, gems, and/or a real-money price in toman —
but the client lists them only in the «اتاق پرو» screen (`apps/mobile/src/wardrobe/`); the hujre shows the other effects.
The server API is unchanged (`GET /shop`, `POST /shop/:id/buy`, `POST /shop/:id/equip`, the Bale invoice for real money).

Paid-for-real-money items are shop items with a toman price (D170, only offered when `feature.coin_packages` is on).

## Streak shield (D204, built)

Effect `streak_shield` (inventory row, at most `STREAK_SHIELD_MAX_HELD` = 2 held; starter item «سپر استریک», 30 coins, level 2, one a day). A shield bridges
**exactly one missed day** of the daily reward: a claim up to one more cooldown past the streak window keeps the streak (`nextDailyReward(..., shields)`), and the
claim spends one shield inside the same transaction (`shieldUsed: true` in the reply; `GET /daily-reward` also returns `shields`). Beyond 2 held the shop answers
`max_held` / item `blocked: MAX_HELD`. The store icon is a placeholder (`umbrella`) until the designer draws one.

## Daily rotating shop (D204, built)

Items carry `rotating`. Each Tehran day only `shop.daily_slots` (default 4; 0 = all) of the rotating pool are offered, the same for every player
(`pickDailyShop`, seeded by the date key); non-rotating items are always there. `GET /shop` lists today's offer plus `rotatesAt`; buying a rotating item that is not on
today's offer answers `not_today`. Admin «فروشگاه» has a «چرخان کن» toggle per item. **No item is rotating by default** (existing rows keep behaving as before):
flag a few higher-priced items to switch the rotation on. The app shows «فقط امروز · N ساعت مانده» on them.

## API

`GET /shop`, `POST /shop/:id/buy` · `GET /solo/:id/hints`, `POST /solo/:id/hint {kind}` · admin `GET|POST /admin/shop`, `PATCH /admin/shop/:id`
(permission `economy`). Switch: `feature.shop`.
