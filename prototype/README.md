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
- `queue.html` — matchmaking wait screen (ETA, cancel, practice-while-waiting, puzzle info);
  auto-"finds" an opponent after a few seconds to demo the transition into a match.
- `table.html` — private table host controls (room code, format/entry-fee, seat management,
  lock/extend) per §Private table.
- `profile.html` — avatar/nickname (with unlock-gated buttons), equipped tag + tag gallery, stats,
  match history (doubles as coin history), chat-lock/redeem CTA, invite/referral block, optional
  phone-link flow — per `profile-and-identity.md`.
- `settings.html` — sound/vibration toggles, replay tutorial, about/support, logout/delete.
- `ugc.html` — submission form (name/photo, year+price with toman/rial toggle, source, category)
  and the single-card swipe voting feed, per `ugc.md`.

Not built as static pages: the in-match chat drawer (lives inside `index.html`'s match screen,
not a separate page) and the admin panel (not yet interviewed/spec'd).
