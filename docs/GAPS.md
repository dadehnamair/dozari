# What is still missing — review of 2026-10-03

A pass over every design file (`docs/design/*.dc.html`) and every spec (`docs/logic/*.md`) against the code. "Verified" = checked in code or in
a browser this session. Order inside each part is by how visible it is to a player. Nothing here is new product scope: each line is something a
design or a spec already asks for.

## A. Designs not (fully) in the app

| # | Design | What is missing | Notes |
|---|---|---|---|
| A1 | `17 Chat Shop Unlocks` · **shop** | Tabs «سکه» (coin packs), «جم», «لباس», «آواتار», «ویژه» are dimmed «به‌زودی»; only «کمکی» sells | Coin packs are fully built on the server (`/coin-packages`, Bale invoice, D91/D129) but no client tab calls them. Gems do not exist as a currency (owner decision open). Outfit / avatar / offer need products first. |
| A2 | `17` · **chat** | Tabs «هم‌تیمی» and «قبیله»; quick-reply chips; stickers; a coin gift sent inside the chat | App has city chat (+ global), friends' DM and duel taunts. 2v2 has **no team chat** (spec: team channel). «قبیله» (clan) has no spec at all. |
| A3 | `13 Match Screens` · **results** | The reward tiles (coins won/lost) | The client is not told the coins paid (ledger only). Power-ups (magnifier / freeze / +time) are not in the rules and were left out on purpose. |
| A4 | `13` · **match HUD in 2v2** | Four avatars (teammates + rivals); a team shows «الف و ب» text only | Needs a 2-up avatar in `MatchHud`. |
| A5 | `08 FX` | twinkle, rings, flicker, pop, drop, shine, level-up rays | Only confetti and rain are ported (`kit-status.md`). The level-up moment has no effect at all. |
| A6 | `09 Avatars - Badges` | Tier shields, tag pills, era stamps are **only in the dev gallery** | Verified: `TierBadge`/`TagPill`/`EraStamp` are used nowhere in the game. |
| A7 | `02 Backgrounds`, `03 Brand` | `bg-paper-tile`, layered parallax; native splash image; notification-icon plugin | Web icons/PWA done; native build config is not. |
| A8 | `04 Characters` | `dozariF` has no month costumes; the app icon cannot follow gender/month (D68) | |
| A9 | `19` · **notifications** | Compare with the inbox page once more against the design (rows, filters) | Inbox exists (D99); not re-measured against the mock-up. |
| A10 | `15 Instagram Launch`, `16 Coming Soon Video` | Marketing assets, not app screens | PNG exports are in `docs/design/export`; nothing to build in the app. |

Done this session and worth knowing: the winding level road (`17` · levels), the first-run **login screen** (`19` · login — phone → five-box code,
«مهمان بازی کن»), the own profile and the player card (`11` · profile).

## B. Specs not (fully) built

| # | Spec | What is missing |
|---|---|---|
| B1 | `price-guess-round.md`, `game-rules.md` | **The price-guess round for duels / 2v2.** `resolveWinner` and `finalScores` exist in `packages/shared` but nothing calls them: a tied match ends as a draw, and there is no hidden-entry / simultaneous-reveal UI. Solo has it. |
| B2 | `result-chart.md` | The price chart and product stories after a **duel** (solo only today) and the **share card** (view-shot + share with the invite code). Only a plain text `Share.share` exists. |
| B3 | `ugc.md` | «پیشنهاد کالا» form, the swipe voting feed, admin approval to product/price point, coin reward. Tables exist in the schema; no server routes, no client; the hub building is disabled. |
| B4 | `matchmaking.md`, `bots.md`, `game-rules.md` D43 | Reconnect grace, the ready handshake, **bot takeover of a seat a human left**, match-log persistence, bots at private tables, bots accepting friend requests. |
| B5 | `economy.md`, `matchmaking.md` | **2v2 entry fee and prize** (D140), private-table pots, difficulty-scaled fee (D51), abandon cool-down. |
| B6 | `chat-and-access.md` | Team channel in 2v2, text chat at private tables, per-player mute lists, a muting UI for «آجان» in the app. |
| B7 | `matchmaking.md` | A **party of 2** joining the public 2v2 queue together. |
| B8 | `game-rules.md` (D143) | A per-board recap on the 2v2 result screen (only the last board's solution is shown). |
| B9 | `tournaments.md`, `daily-puzzle.md`, `message-center.md` | Recurring tournaments and a live bracket push; the daily puzzle's leaderboard / share card / "today's puzzle is up" notice; scheduled messages, templates, per-channel opt-out. |
| B10 | `profile-and-identity.md` | Avatar / nickname galleries and `user_tags` tables (PLAN Phase 4-A), the public player number + default handle (D123), the app icon following gender. |
| B11 | `puzzle-generation.md` | Rule kinds `first_crossed`, `same_price_at_year`, `cheaper_than_ref`, `category_price_rank`; AI-drafted group titles with a human pick. |

## B+. Added after the review (2026-10-03)

- `ErrorCard` is used only by the live duel and solo screens; the shop, chat, tournaments, leaderboard and friends still show a plain error line (D155).
- The wheel's «سهمیه»/daily meaning needs the owner's confirmation (D154); the admin cannot yet gift spins to one player.

## C. Content and operations

- **Content is the real blocker.** The server has one starter product and (until the admin builds them) no puzzles. The generator needs ≈150
  products with ≥ 3 approved price years (`HANDOFF.md` #25). The scheduled top-up (D141) only helps once the catalog exists.
- `PLAN.md` Phase 0 spikes and Phase 7 items are still open: self-hosted OTA, error tracking, self-hosted analytics, a 500-match load test,
  store listings (Bazaar/Myket) and a Persian privacy policy, backup/restore drill.
- **`PLAN.md` itself is stale**: many finished items are unticked (the 1v1 queue, bot pool, chat service, ledger, lobby, match screen, profile …).
  Tick them in one sweep so the plan can be trusted again.

## Suggested order (if the owner agrees)

1. A1 coin tab (small, the server is done) → real money path is visible. 2. B1 + B2 (finish the duel: price round, chart, share card) — the loop the
brief is built around. 3. A3/A4 + B8 (2v2 result and HUD polish). 4. B6 team chat. 5. B3 UGC. 6. A5/A6 effects and badges used in the game. 7. B4.
