# Static MVP prototype

`index.html` — standalone, open in any browser. `mvp.body.html` is the same page without the
document skeleton (the version published as a claude.ai artifact); edit that one and regenerate
`index.html` by wrapping it with the doctype/head (see git history for the one-liner).

What it demonstrates (all client-side, no server):
- Connections-style board with 2 hand-authored puzzles, validated on load by a JS port of
  `validatePuzzle` (docs/logic/puzzle-generation.md).
- Solo mode (4 mistakes) and a 1v1 demo against a simple bot using the proposed D8 turn rules
  (shared board, streak on correct, 45 s turns, 4-mistake lockout, auto-revealed last group).
- Coins per docs/logic/economy.md defaults (entry 20, 10% house cut, consolation 5), stored in localStorage.
- Canned taunts + locked free-chat input (docs/logic/chat-and-access.md).
- Post-match overlaid log-scale price chart per group (docs/logic/result-chart.md).

Prices are illustrative placeholders, NOT verified data — never import them into the real catalog.
