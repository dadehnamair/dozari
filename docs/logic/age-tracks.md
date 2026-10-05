# Age tracks (رده‌ی سنی) — kid / teen / adult

Status: **proposed**, nothing built yet (D197). Owner request 2026-10-05: one game for every age; kids get an educational space; a parent
can hold the adult account and add the child; the admin panel can filter and manage everything by age band.

## Principles

1. **One app, three tracks.** Not three apps and not a «kids' game» bolted on. The adult track stays the full price-nostalgia game; the app must
   never make an adult feel they are in a children's product (copy, home, art, store listing). Wording: «بازی برای هر سن»; the kid space is
   named «دوزاری کوچولو» (working name, brand call for the owner).
2. **The track is chosen, never computed from a birth date.** We store a coarse track chosen by the user (kid / teen / adult); no ID, no school. The optional
   birth date of D160 (minimum age 10) stays as it is and is **independent**: it never picks or changes a track and no rule reads it. A kid profile
   created through a guardian has no birth date field (under the D160 minimum), so the birthday week simply does not apply to it. In code the word is
   **track** (`AgeTrack`, `age_track`, `trackRules`); `AGE_BANDS` in `shared/calendar/birthday.ts` is the unrelated admin age histogram.
3. **Everything is band-aware.** Players, puzzles, items, lessons, matchmaking, chat, tournaments, leaderboards, rewards, settings and admin
   views all carry or derive a band, so each can be listed, filtered and switched off per band.
4. All numbers (band edges, which feature each band gets) live in `packages/shared/src/config/ageTracks.ts` (non-negotiable rule 9).
   UI strings in `apps/mobile/src/i18n/fa.ts`; lesson text and kid group titles are DB content.

## Bands

| band | id | age | game | proposed edges |
|---|---|---|---|---|
| Kid | `kid` | up to 11 | learning space: easy picture puzzles from things kids know (food, school, toys, fruit), then a word lesson | `AGE_BAND_EDGES = { kidMax: 11, teenMax: 17 }` |
| Teen | `teen` | 12–17 | the real game, easier tiers first, price rounds without coin wagers | |
| Adult | `adult` | 18+ | the full game as today | |

The edges are config. A user's band is **chosen**, not computed, so the edges only label the choice («تا ۱۱ سال»).

## First-run flow

After the login step of D147 (and before the tutorial) one new screen: «چه کسی بازی می‌کنه؟» with three big cards (کودک / نوجوان / بزرگسال).
It is shown once, stored on the account, and reachable later from settings.

- **Adult:** continues as today. No kid content anywhere.
- **Kid or teen:** the app says «برای کودکان فضای آموزشی ویژه داریم» and asks for a **guardian's phone number** (OTP, same code path as
  `profile-and-identity.md` §Phone login). When the guardian verifies, the child profile is created and linked.
  - If the guardian has no account yet, one is created from that number (adult band, phone verified).
  - A kid/teen can still **play first** while the guardian step is pending, but only inside the safest rules (no matchmaking, no private tables,
    no chat). The guardian step unlocks the rest of the band's rules. (Open: or make it a hard gate for `kid`; see Open questions.)
- **Guardian side:** one phone number = one adult account holding **many child profiles** («افزودن فرزند»). Each child profile has its own
  nickname, avatar, band and progress; the guardian switches between them. A child profile has no phone of its own.
  A child on another device joins with a short **link code** the guardian shows (6 digits, 10 minutes, one use).
- Self-declared bands can be false. Mitigation is structural, not policing: kid/teen rules are restrictive, and **moving a profile to an older
  band needs the guardian** (a kid cannot promote themselves to teen or adult). Moving to a younger band is free for anyone (an adult can try
  the kid space through «حالت پیش‌نمایش», see below).

## What each band gets

| area | kid | teen | adult |
|---|---|---|---|
| Puzzle content | kid pool only (`age_track = kid`) | teen pool + easy adult groups | adult pool (+ teen pool as an option in settings) |
| Price-guess round | **off** (replaced by the word lesson) | on, **no coin wager** | on, with the D24 wager |
| After a puzzle | **word lesson** (letters, word, picture, short story) | normal result chart; lesson optional | result chart |
| Free-text chat | never | never (canned taunts only, even with a redeemed code) | with a redeemed invite code (rule 7) |
| Canned taunts | kid-safe set only | teen set | full set |
| Matchmaking | same band only; bots of the same band | same band only | adult only |
| Private tables | only with their linked guardian (or another child of the same guardian) | friends of the same band, guardian-linked | all adults; may host a family table with their child |
| Coin wagers, wheel prizes with coins/gems | no wagers; wheel allowed, prizes kid-safe | no wagers | as today |
| Real-money purchases | none | none | per `economy.md` (when enabled) |
| UGC (suggest items) | no | no | yes |
| City / province on public profile | hidden | hidden | as today |
| Leaderboards & tournaments | own band only | own band only | adult |
| Public profile sheet (D67) | nickname + avatar + level only | nickname + avatar + level + stats | as today |
| Invite codes | can redeem (a reward for the guardian), cannot share outward | same as kid | as today |

Everything above is a **row in the band config** (`ageTracks.ts`), not scattered `if (band === 'kid')` checks: one pure function
`trackRules(band)` returns the feature set, and the server calls it on every guarded action. The client only reads the result from
`GET /config` and `GET /me`.

## Kid word lesson («کلمه‌آموزی»)

After a kid puzzle ends, each of the four groups opens a card (swipe through, skippable):

1. The picture and the word, big (`item.word_fa`).
2. **Letters:** the word split into letters, each shown separately and joined, with the count («۳ حرف: ن ـ ا ـ ن»).
3. A one-line story or fact (DB text, e.g. what it is, who eats it) and an optional syllable split.
4. Optional audio later (bundled files, no cloud TTS — rule 8).

Pure function `splitWordLetters(word)` in shared (handles ZWNJ, joining forms, ignores diacritics except as a mark on its letter; unit tests with
real words). Lesson text is **hand-written and reviewed**; a kid lesson cannot be published without an editor's approval (admin queue below).

Kid scoring is gentle: stars instead of price error, no loss screen with a coin number, a retry is always offered.
Kid difficulty comes from `progression.md` skill tiers, but on its own ladder (a kid ladder runs over kid puzzles only).

## Data model (to add to `data-model.md` when built)

- `users.age_track` ENUM(`kid`,`teen`,`adult`) NOT NULL DEFAULT `adult` (existing users stay adult), `users.age_track_set_at` DATETIME(3) NULL
  (NULL = not asked yet, so the chooser shows once).
- `guardian_links(guardian_id, child_id, created_at, revoked_at)`; a child has at most one active guardian; the guardian is an adult with a
  verified phone. A guardian can revoke (the child profile is kept, locked to the safest rules, and shown «ورود با شماره‌ی ولی»).
- `puzzles.age_track` and `items.age_track` (the lowest band the content is meant for) plus `puzzles.audience` rule via config: which bands may be served.
  `validatePuzzle` gains a check that a kid puzzle uses only kid items (rule 5 still holds).
- `item_lessons(item_id, word_fa, story_fa, syllables_fa NULL, status, reviewed_by, reviewed_at)`; letters are computed, not stored (no JSON, D63).
- `canned_taunts.age_track` and the word filter keep working as today; kid text never goes through free text, so the filter does not need a kid mode.
- Match rows record `age_track` so history, stats and the admin can split by band.

## Server rules

- Every endpoint that can reach another player or serve content calls `trackRules(user.age_track)` and refuses (`403 {error:"age_track"}`) what the band does not
  allow; matchmaking queues are **keyed by band** (`queue:{mode}:{track}`), so a kid can never be paired with an adult by a bug in one filter.
- Bots in a band (`bots.md`) get the same band and a band-appropriate nickname list.
- `POST /age/track {track}` (own band, younger or same: free; older: needs the guardian's confirmation through the guardian's session).
- `POST /guardian/children`, `POST /guardian/link-code`, `POST /guardian/children/:id/track|revoke`, `GET /guardian/children` (guardian-only).
- Coins stay in `coin_ledger` only; a guardian cannot move coins to a child outside the existing gift path (D-wallet rules unchanged).

## Admin panel

A new section **«رده‌های سنی»** (and an **age-band filter chip on every existing list**: users, puzzles, items, lessons, tournaments, reports,
bots, message center audience, coin ledger, matches):

- Overview per band: players, daily actives, matches, completion rate, average stars/accuracy, reports.
- Band config editor: edges, per-band feature switches (a kid-safe kill switch for any feature), shown through `GET /config`.
- Content: kid/teen puzzle and item browsers with the lesson editor and a **review queue** (draft → approved) for kid content; counts of puzzles per
  band and tier so gaps are visible.
- Guardians: list, their children, link/revoke, support actions (re-link, move band).
- Moderation: reports on kid profiles go to a separate queue; ban/log-out tools as in D74.
- Message center (D73): audience can be limited to a band; adult marketing text never goes to kid/teen profiles.
- Audit log records every band change and guardian action.

## Adult experience (guardrails)

- The chooser's adult card is first and wears the main brand voice; kid art, stars and the word lesson never appear in an adult account.
- Store listing and splash use the neutral brand (`brand.md`); the kid space is introduced as a feature («فضای کودک»), not the app's identity.
- **Preview mode** («پیش‌نمایش کودک») lets a guardian open the kid space read-only (no progress, no coins) to judge it.

## Phases

1. **Foundation:** `age_track` on users/puzzles/items, `trackRules`, chooser screen, band-keyed queues, admin band filter and config. No kid content yet.
2. **Guardian link:** phone OTP for the guardian, child profiles, link code, band-change confirmation.
3. **Kid content & lesson:** kid puzzle pool (30–50 hand-made to start), `item_lessons`, `splitWordLetters`, lesson cards, review queue.
4. **Family play:** parent + child private table, a guardian digest («امروز چه یاد گرفت»).

## Open questions (proposed defaults)

- Band edges: up to 11 / 12–17 / 18+.
- Is the guardian step a hard gate for kids? Proposed: **yes for `kid`** (nothing but solo practice before it), **soft for `teen`**.
- Can teen and adult share any table? Proposed: **no**, except a guardian-linked family table.
- Whether Bazaar/Myket/Bale require extra age labelling or a privacy page for a kids' section: check store rules before phase 2 ships (owner).
- The kid space's name and mascot: brand decision.
