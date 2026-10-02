# Player progression: level/XP and skill-tier puzzle difficulty

Owner (2026-09-27): "لول‌بندی کاربرا رو نداره" and "باید سعی کنیم اسکیل بازی رو تعیین کنیم که
هرچی مهارت میره بالا سخت‌تر هم بشه" — the app needed a visible sense of growth (D33) and a way
for puzzles to actually get harder as a player improves (D34). Both are config-driven per
`CLAUDE.md` rule 9; all numbers below are **proposed defaults**, not final-tuned.

## Level / XP (D33)

Purely cosmetic progression, shown as a level badge + XP bar on the avatar (profile) and a small
level chip in the match header. **Never affects matchmaking** — D12 (no ELO/rating-based queue)
is unchanged; this is a different axis (visible growth, not opponent selection).

- XP awarded on every **finished** match (abandons don't count, same rule as
  `profile-and-identity.md`'s "finished game"):
  - `XP_SOLO_BASE` = 5, `XP_DUEL_BASE` = 10 (proposed; team/private can reuse the duel base).
  - `XP_WIN_BONUS` = 15 (competitive modes only).
  - `XP_PER_PRICE_GUESS_POINT` = 2 — rewards the bonus round too (solo: staircase points; duel:
    rounds won), so a strong price-guess showing still grows the level even on a puzzle loss.
- Level curve: `xpForLevel(n) = 50 * n²` (total XP to reach level `n+1`) — deliberately steep
  early (level 2 at 50 XP, roughly one strong match) and slower later, a standard "early wins
  come fast" curve. Config in `packages/shared/src/config/game.ts` as `LEVEL_XP_CURVE` (a
  function or precomputed table — implementation's choice).
- Level-up triggers a small celebratory moment (toast + pop animation in the prototype; a
  confetti/share-card moment would be a nice Phase 6+ addition, not required at MVP).

## Level rewards on the road (D117, proposed)

- Every **5th level** (`levelreward.every`, 0 = off) pays coins once: `levelreward.base_coins × (level / every)` — with base 25: level 5 = 25,
  level 10 = 50 … level 50 = 250 (1375 in all up to level 50). Both are admin settings (defaults `LEVEL_REWARD_*` in `config/progression.ts`).
- The player takes them from the level road (`POST /me/levels/claim` pays every reached, untaken reward; `GET /me/levels` lists `rewards` with
  `claimed`). A claim row per user + level (`level_reward_claims`) plus the idempotent ledger key `level_reward:<user>:<level>` make a double tap or
  a second device pay nothing twice. Players already past a level can take its reward.
- Shop tiers open along the same road: hint packs of 10 / 20 / 50 at levels 10 / 20 / 35 (`DEFAULT_SHOP_ITEMS`; defaults missing from the table are added
  on start, admin edits of price and level stay). The road shows them as shop cards via the existing `minLevel` gate.
- Needs the economy simulation: the road is a new faucet (~1375 coins over 50 levels, next to a 200-coin signup bonus).

## Puzzle difficulty scales with skill tier (D34)

Reuses the **skill-rank tag** that already exists in `profile-and-identity.md` (تازه‌کار /
مبتدی / حرفه‌ای, derived automatically from win rate — cosmetic, no ELO). That tier now also
biases which puzzles a player is served:

- Every puzzle gets a `difficulty_tier` (آسان / متوسط / سخت) set by the curator (or, once the
  generator exists, inferred from how many "near-miss" red herrings `puzzle-generation.md`'s
  `validatePuzzle` finds — more near-misses ≈ harder). This is independent of the per-group
  yellow→purple difficulty ladder inside a single puzzle; it's a difficulty rating for the
  *puzzle as a whole*.
- **Solo/practice**: puzzle selection is weighted toward the player's current skill tier (e.g.
  70% same tier, 20% one tier up, 10% one tier down) instead of uniform-random — a تازه‌کار
  mostly sees آسان puzzles, a حرفه‌ای mostly sees سخت ones, but it's never a hard gate (some
  variety/surprise stays, and a player can still hit "practice solo" and get an easier or harder
  one occasionally).
- **Duel/team/private**: the match needs one puzzle both sides play, so the weighting uses the
  **higher tier of the two matched players** (keeps it fair to the stronger player rather than
  dumbing the match down to the weaker one) — falls back to an average if that skews queue times
  too much post-launch (open question, needs real data like the bot-fallback timing in
  `bots.md`).
- This is **content selection, not matchmaking** — D12 (FIFO queue, no rating-based pairing)
  stays as-is; two players of very different tiers can still be matched, they just play a puzzle
  weighted toward the stronger one's level rather than always the easiest.
- Config: `PUZZLE_TIER_WEIGHTS` in `packages/shared/src/config/game.ts`.

## Board size as a difficulty lever (D47)

A further extension the owner asked for on top of D34: easier tiers can offer a **smaller board**
(e.g. 3×3 = 9 items / fewer groups) instead of always the fixed 4×4/16-item Connections board;
harder tiers can go **larger** than 4×4. Owner: "واسه شروع بازی یسری گزینه‌های آسون‌تر مثلا ۳×۳
باشه، ۴×۴ نباشه، ولی توی لول‌های خیلی سخت تعداد جدولش بیشتر هم بشه." This is a bigger change than
the rest of D34 (which only varies *which* puzzle/rule-subtlety a player sees, keeping the board
shape fixed per D19's original brief) — board geometry itself becomes a lever.

**Proposed scheme** (not implemented in the prototype yet — too structural to mock without
misleading the real design; needs owner sign-off first):

| tier | board | groups | notes |
|---|---|---|---|
| آسان | 3×3 (9 items) | 3 groups of 3 | fewer red herrings possible with only 3 groups; good onboarding-adjacent difficulty, separate from D37's one-time tutorial ramp |
| متوسط | 4×4 (16 items) | 4 groups of 4 | unchanged — today's only shape, stays the default |
| سخت | 4×5 (20 items) | 5 groups of 4 | adds a 5th, hardest tier on top of yellow→purple (needs a new tier color + name) |

Consequences this scheme would need worked out before implementation: `GROUP_POINTS` and
`LV_NAMES` need a 3-group and a 5-group variant (or a formula instead of fixed arrays);
`validatePuzzle` (`puzzle-generation.md`) already checks group count generically but its "exactly
4 groups" hard check would need to become tier-aware; and — the actual content cost — every
existing 4-group puzzle needs a hand-authored 3-group *and* 5-group sibling, roughly tripling the
authoring load per puzzle "family." That content cost is why this stays proposed rather than
built: it's a real scope increase on top of D32's 200-puzzle target, not just a code change.
Tracked as `DECISIONS.md` open question 17.

## Open follow-ups

- Exact XP numbers and tier-weighting percentages need playtesting, same as the rest of
  `economy.md`'s numbers — not blocking Phase 0-A/0.
- Whether `difficulty_tier` is curator-set only or ever auto-inferred from validator near-miss
  counts is a Phase 2 content-pipeline decision (`puzzle-generation.md` §Content bootstrap order).
