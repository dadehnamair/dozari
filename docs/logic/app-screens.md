# App screens — UI-level decisions from the owner interview

This file captures screen-by-screen UI decisions from the 2026-09-27 owner interview that don't
belong in a game-logic spec (those are `price-guess-round.md`, `profile-and-identity.md`,
`bots.md`, and the existing `matchmaking.md`/`game-rules.md`/`chat-and-access.md`). Treat this as
part of the same "logic specs" set in `CLAUDE.md` — read it before building the matching screen.

## Onboarding (first app open, before any account setup)

1. **4-slide tutorial**, skippable both by swipe-dismiss and an explicit "رد شدن" button. Slides:
   1. Goal of the game + a worked example of solving one group in the Connections puzzle.
   2. The 4-mistake rule: what happens when you run out (game over / turn passes).
   3. The price-guess bonus round (`price-guess-round.md`) — what it is, that it happens after
      every puzzle.
   4. Coins/economy: entering and playing is free; tables/matches can cost coins.
2. After the tutorial, a **random nickname + avatar** is assigned silently (no signup screen) —
   see `profile-and-identity.md`. The user lands straight on Home.
3. **The first solo puzzle played is an eased tutorial run (D37)**, on top of the slide tutorial
   above — owner: "یکم گنگه... بنظرم مرحله اول آسون‌تر باشه که آشنا بشن." It's always the first
   authored/curated puzzle, allows 2 extra mistakes before locking out, and shows a banner over
   the board with a one-line worked example ("اولین دسته همیشه از همه واضح‌تره") instead of a
   separate non-interactive demo screen — keeps the ramp inside the real game loop rather than a
   second tutorial to sit through. Applies once, gated by a local "first solo game" flag; every
   game after it (including a first duel, if that's played before any solo game) is normal
   difficulty. Prototype: `prototype/index.html` (`S.tutorial`, `gh_solo_played`).

## Home / Lobby screen

Laid out as **screen-home** of `docs/design/Dozari - 01 Screens.dc.html` (D99, replaces the earlier
"one row of equal mode cards"):

- **Top counters** (three pills): coins, daily-puzzle streak, level.
- **Wordmark** and a **speech bubble** under it: "today's puzzle is ready" (tap → daily puzzle) while
  it can be played, otherwise the month's mood line.
- **Corner tiles**, one column per side (54px candy squares with a label; a tile shows only when its
  feature flag is on). Right: daily reward (badge when claimable), private tables, tournaments, price
  lookup. Left: settings/profile, messages (unread badge), city chat, shop, Bale.
- The **hero** character floating over the bazaar background.
- **Two big buttons** at the bottom: solo play (green) and duel (orange). When an unfinished match
  exists the orange button becomes **back to your game** with a badge (D42).
- Still to come from the design: the mode screen (duel / team / play with a friend) behind the duel
  button, the online-player badge (D45) and the UGC entry.

## Game board (solo and daily puzzle)

Laid out as **screen-match** of `docs/design/Dozari - 01 Screens.dc.html` (D99): violet checkered
background; top bar with a square back button, the yellow title plate (practice / daily puzzle) and a
hint button; the character beside a speech bubble that carries the prompt, the last guess's feedback
(the character's pose follows it) or revealed hint titles; the 4×4 board; «فرصت‌ها» dots (one per
chance left); and three action slabs: shuffle, clear, submit (wider, dimmed until four are picked).
The end of a game (banner, price round, chart) keeps its earlier layout for now.

## Matchmaking queue (waiting) screen

Shown between tapping a competitive mode and the match actually starting:

- Estimated wait time + a visible **cancel** button.
- **"Practice solo while you wait"** option, running on the same screen/timer — doesn't lose the
  queue slot (see `matchmaking.md`; this is also the moment a bot silently fills in per `bots.md`
  once the wait threshold passes — the UI never distinguishes that case).
- Short info about the puzzle that's queued: number of groups (always 4) and a difficulty hint —
  enough to set expectations, not enough to spoil anything.

## Private table — host controls

Only available **before** the match starts; once everyone is seated and the host hits start, the
host loses seat-control (owner: "بعد از شروع میزبان کنترل صندلی نداره" — keeps mid-match behavior
identical between private and queued matches, per the redaction/authority model in
`ARCHITECTURE.md`):

- Change format (1v1 / 2v2) and entry fee, any time before start.
- Move/kick guests between seats.
- Lock the table (blocks further joins) and extend it if it's about to expire
  (`ROOM_IDLE_MINUTES` in `matchmaking.md`).
- **More host "ownership" features (D52)**: a custom table name + emoji, a board-difficulty
  picker (drives the entry fee via D51), and a "require every guest to confirm ready before start"
  toggle — see `matchmaking.md` §Private tables for the full writeup. Owner: "موقع ایجاد میز یکم
  امکانات بیشتر بدیم به سازنده که حس مالکیت رو بهش القا کنیم." Prototype: `screens/table.html`.

## Resume-match indicator (D42)

Reopening the app with an unfinished match still active server-side shows a persistent
badge/banner (Home screen, ideally reachable from anywhere via a nav-level badge) offering to
rejoin — not just "reconnect works if you happen to navigate back into the match screen." Owner:
"اگه بازی رو باز داشتم و افتادم بیرون، موقع برگشت یه آیکن بگه هست و می‌تونه دوباره بپیونده."
Backend mechanics (grace window, resume snapshot) already exist per `matchmaking.md` §Reconnects &
abandonment — this decision is specifically that the client must surface it proactively. Prototype:
`index.html` sets a `gh_active_match` flag on duel start (cleared on finish/abandon);
`screens/home.html` reads it and shows the banner.

## Leaderboard & tournaments (D49/D50)

A dedicated screen the player can reach any time (linked from Home and from Profile), covering
three things in one place:

- **Rankings**, filterable by period — امروز / این هفته / این ماه / کل بازی — and optionally by
  province (ties into D53). Owner: "یه‌جایی باشه بتونه کاربر بره رقابت‌ها هم ببینه" و "جایگاه
  کاربرارو بر اساس روز هفته ماه و کل بازی نشون بده."
- **Players** — browse/search other users, send friend requests (D44, full spec in
  `profile-and-identity.md` §Friends & player browsing).
- **Tournaments** — owner: "یه صفحه هم باشه تورنومنت برگزار کنیم." Format is decided: **single-
  elimination bracket** (D60) — one duel-puzzle match per round, loser is out, winner advances,
  down to a final. `prototype/game.html`'s tournament tab mocks a 16→8→4→🏆 bracket-progress
  strip alongside the entry card (fee/prize/start time/join button). Bracket size beyond 16, the
  bye rule for odd signup counts, and the full prize table are still open (`DECISIONS.md` open
  question 15).

Prototype: `screens/leaderboard.html` (rankings/players/entry card) and `game.html`'s leaderboard
scene (adds the bracket-progress visual). Backend needs a ranking query (probably a periodic
materialized view or a scheduled aggregation job, not a live query per request) and, for
tournaments, new tables (bracket/round/match rows) plus a scheduler to advance rounds — neither
designed yet.

## Icon caption convention (D48)

Any icon-only control gets a short text caption underneath it, not just a hover title. Already the
pattern for the bottom nav and mode cards; apply it to every new icon-only control going forward
(friend-request button, resume-match badge, online-count pill, etc.) rather than relying on a
tooltip alone. Owner: "زیر متن‌های اون آیکن‌ها یه راهنمایی کوچیک هم باشه قشنگ میشه."

## In-match chat drawer

- A **floating icon button** in a corner of the match screen (not an always-visible panel) —
  opens the chat drawer on tap; a **red badge** shows when there's an unread message. Keeps the
  puzzle board uncluttered, which matters more here than a persistently visible chat.
- Drawer contents (taunts, free-text gating, team/all channels) unchanged — see `chat-and-access.md`.

## Settings screen

- Sound and vibration toggles (independent on/off switches).
- Delete account / log out.
- "Replay tutorial" — re-opens the 4-slide onboarding flow from Settings, for a returning user
  who wants a refresher.
- About us / support / contact support (static content + a contact channel — exact channel
  (Telegram, email, in-app form) is a content/ops decision, not logic; track as a small open
  item, not blocking).

## Wallet / coin history

**No separate wallet screen** (owner decision, 2026-09-27): the Profile screen's match-history
list (`profile-and-identity.md`) is the coin history — each row already shows coins won/lost per
match. No dedicated full-ledger view (all faucets/sinks) at MVP; revisit only if players ask for
non-match coin movements (daily bonus, invite rewards) to be individually visible.

## Admin panel (first pass, 2026-09-27 — resolves part of open question 11)

**Target platform: a full-featured web app (D38)**, not a screen bolted onto the Expo mobile
client — owner: "ادمین پنل باید واسه وب هم باشه با امکانات کامل که بشه از اونجا مدیریتش کرد
بیشتر." Real auth/roles and every moderation/ops action below need to be actually actionable from
a browser, not just viewable. `prototype/screens/admin.html` is an interaction-design mock only
(static, no backend, no auth) — it validates the information architecture below, not the
implementation target. Stack choice (plain React/Vite admin app vs. reusing Expo web, per
`ARCHITECTURE.md`) is still open, track as Phase 7 in `PLAN.md`.

Not a full interview yet — the mock is a starting point to react to, covering the moderation/ops
work already implied by other specs rather than new decisions:

- **Dashboard**: rough activity KPIs + the D32 content-target progress bars (products, puzzles)
  so the team can see launch-readiness at a glance.
- **Puzzles**: approval queue for hand-curated puzzles (`puzzle-generation.md` §Content bootstrap
  order) — approve/reject per puzzle.
- **UGC**: moderation queue for submissions that crossed the community vote threshold
  (`ugc.md`) — shows the outlier-price flag from that spec, approve/reject overrides the
  community auto-state.
- **Economy**: a faucet/sink breakdown (which coin sources/sinks make up circulation this period)
  — a simple ops view on top of `economy.md`, not a new balancing decision.
- **Users**: search + mute/ban — the moderation actions `chat-and-access.md`'s profanity
  filter/report flow needs a human backstop for.

Still open: admin authentication/roles, real backend wiring, and whether this stays inside the
Expo web build (`apps/admin`, per `CLAUDE.md`'s repo map) or a separate tool — track as a Phase 7
task in `PLAN.md`, not blocking Phase 0-A/0.

## Open follow-ups

- Achievement/tag catalog content (which badges exist, unlock rules) is content work, not logic —
  tracked as a Phase 6/7 content task in `PLAN.md`, not a screen-design question.
- UGC voting-feed screen is now specified in `docs/logic/ugc.md` §Voting feed UI (single-card
  swipe, approve/reject) — no longer open.
- Admin panel: see §Admin panel above — first pass done, full interview still open.
