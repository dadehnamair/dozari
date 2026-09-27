# Static MVP prototype

`index.html` — standalone, open in any browser. Single source of truth (the former duplicate
`mvp.body.html` was removed); publish this file directly when an artifact is needed.

What it demonstrates (all client-side, no server):
- Connections-style board with 2 hand-authored puzzles, validated on load by a JS port of
  `validatePuzzle` (docs/logic/puzzle-generation.md).
- Solo mode (4 mistakes) and a 1v1 demo against a simple bot using the proposed D8 turn rules
  (shared board, streak on correct, 45 s turns, 4-mistake lockout, auto-revealed last group).
- Coins per docs/logic/economy.md defaults (entry 20, 10% house cut, consolation 5), stored in localStorage.
- Price-guess bonus round after every puzzle (docs/logic/price-guess-round.md): solo 5-tier
  staircase scoring; duel blind-simultaneous guesses with a per-round coin wager (demo pins
  `PRICE_GUESS_ROUND_WAGER=3`, inside the documented 2–5 range) and the D31 locked-out
  consolation-bonus badge.
- Canned taunts + locked free-chat input (docs/logic/chat-and-access.md), with a few
  brand-flavored lines from `docs/brand.md`.
- Post-match overlaid log-scale price chart per group (docs/logic/result-chart.md), now preceded
  by a price-guess round summary on the same result screen.
- A **level/XP bar** in the header (`docs/logic/progression.md`, D33) — XP awarded per finished
  match, level-up pop/toast. Purely cosmetic; never affects matchmaking (D12 stands).
- The **first solo puzzle** is an eased tutorial run (`docs/logic/app-screens.md` §Onboarding,
  D37): forces the first authored puzzle, allows 2 extra mistakes, shows a one-line worked-example
  banner over the board. Gated by `gh_solo_played` in localStorage — applies once.
- Duel mode's HUD shows both sides' **avatar, coins, and level** (D39), not just score/mistakes —
  and starting a duel sets a `gh_active_match` flag (cleared on finish/abandon) that
  `screens/home.html` reads to show a "game in progress" resume banner (D42).

Visual language: a "cool arcade" palette v2 (`docs/brand-visual.md` §Color, proposed 2026-09-27,
D35) — cool near-white/near-black chrome, a violet→teal gradient accent on CTAs/logo/level chip,
bigger radii and real elevation, with the locked Connections group colors as the "playful" accent
layer. Supersedes the earlier pastel-paper v1, which the owner found not "cool" enough. Shared
identically by `screens/shared.css` so the whole prototype reads as one app. UI chrome icons (nav,
mode cards, admin actions, chat FAB) use a self-hosted hand-authored SVG set
(`screens/icons.svg`, D36) instead of emoji — each screen inlines the sprite since opening a
static file directly (`file://`) can't `<use>` across separate files.

Prices are illustrative placeholders, NOT verified data — never import them into the real catalog.

## `screens/` — the rest of the app, static/mock data

A separate, linked set of pages for every screen in `docs/logic/app-screens.md` and
`docs/logic/profile-and-identity.md` that isn't the puzzle board itself. These use mock/static
data (no real game logic, no shared localStorage state beyond the coin balance) — they're for
walking through the UI/IA, not for testing rules. Shares `screens/shared.css` (same color tokens
and fonts as `index.html`) so it reads as one app; a bottom nav (خانه / پروفایل / تنظیمات) links
the screens together, and `index.html` links out to `screens/home.html`.

- `onboarding.html` — 4-slide skippable tutorial (swipe or button), per §Onboarding.
- `home.html` — mode cards row (تمرین تکی / ۱در۱ / ۲در۲ / میز اختصاصی), coin balance, daily
  challenge banner, UGC card, achievements shortcut, per §Home / Lobby screen.
- `home.html` also shows an **online player count** (D45) and a **resume-match banner** (D42) when
  `gh_active_match` is set, plus a card linking to `leaderboard.html`.
- `queue.html` — matchmaking wait screen (ETA, cancel, practice-while-waiting, puzzle info); shows
  a **"scanning among players" reveal card** cycling names/avatars before locking onto the found
  opponent (D40/D41 — a bot result looks identical to a human one), then auto-"finds" an opponent
  after a few seconds to demo the transition into a match.
- `table.html` — private table host controls (room code, format/entry-fee, seat management,
  lock/extend) per §Private table, plus D52's extra "ownership" features: custom table name/emoji,
  a difficulty picker that scales the entry fee (D51), and a "require everyone ready" toggle.
- `leaderboard.html` — rankings (day/week/month/all-time + province filter), a players
  browse/search list with add-friend buttons (D44), and a tournament entry card (D49/D50).
- `profile.html` — avatar/nickname (with unlock-gated buttons), equipped tag + tag gallery, stats,
  match history (doubles as coin history), chat-lock/redeem CTA, invite/referral block, optional
  phone-link flow — per `profile-and-identity.md`.
- `settings.html` — sound/vibration toggles, replay tutorial, about/support, logout/delete.
- `ugc.html` — submission form (name/photo, year+price with toman/rial toggle, source, category)
  and the single-card swipe voting feed, per `ugc.md`.
- `profile.html` also shows the level/XP bar (reads the same `gh_xp` key `index.html` writes,
  so playing a match there and reloading this page reflects it) and the skill-tier/puzzle-
  difficulty meter, per `docs/logic/progression.md` (D33/D34); plus an optional province field
  (D53) and a friends preview linking to `leaderboard.html` (D44).
- `chat.html` — the in-match chat drawer's content (taunts, team/all tabs, locked free-text),
  shown as a floating-button + slide-up drawer over a placeholder board, since in the real app
  it's an overlay on the match screen, not its own route.
- `admin.html` — first-pass admin panel mock (dashboard KPIs + D32 content-target progress,
  puzzle approval queue, UGC moderation queue, faucet/sink economy overview, user
  search/mute/ban). Interaction-design mock only — the real thing is a full-featured **web** app
  (D38), not part of the Expo mobile client. Not a full interview yet — see
  `docs/logic/app-screens.md` §Admin panel.
- `icons.svg` — the self-hosted icon sprite source (D36); each screen inlines its `<symbol>` defs
  directly rather than referencing this file at runtime (see note above).
