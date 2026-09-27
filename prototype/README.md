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
