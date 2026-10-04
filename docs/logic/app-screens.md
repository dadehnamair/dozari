# App screens — UI-level decisions from the owner interview

This file captures screen-by-screen UI decisions from the 2026-09-27 owner interview that don't
belong in a game-logic spec (those are `price-guess-round.md`, `profile-and-identity.md`,
`bots.md`, and the existing `matchmaking.md`/`game-rules.md`/`chat-and-access.md`). Treat this as
part of the same "logic specs" set in `CLAUDE.md` — read it before building the matching screen.

## First-run login screen (D147)

screen-login of `19 Social Daily Onboarding`, shown **once** on a fresh install and only when the server can send codes (`GET /config` → `phoneLogin`, true when an SMS
provider is configured): the bazaar at dusk, the waving hero, a cream card with «خوش اومدی به بازار!», the number after a fixed «+98», then five code boxes with a resend
countdown (60 s) and «عوض کردن شماره», and «مهمان بازی کن» under «یا». Signing in with a number that has an account loads that account (the tutorial is skipped); a new number
makes the account (the tutorial follows); guest goes on to the tutorial. The choice is stored (`dozari.loginSeen`) so it never comes back; «ورود با شماره» stays in settings.
Backend: `profile-and-identity.md` §Phone login (`POST /auth/phone/code|verify`, the verify answer carries `created`).

## Onboarding (first app open, before any account setup)

1. **4-step tutorial** (screen-tutorial of `docs/design/Dozari - 19 Social Daily Onboarding`, D99),
   skippable with «رد کن». «آجان», the bazaar guard, talks from the bottom corner over a sample
   board of 16 items: (1) the goal — four groups of four; (2) one group lights up and the rest dim;
   (3) the group is picked and a «ثبت کن» slab shows, with a word on the limited chances; (4) the
   group is solved, plus the nominal-prices and coins line. Step dots at the top; one CTA per step.
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

## Failure cards (D155)

Every screen that cannot reach the server or has nothing to play shows the design-10 card (`components/EmptyState.tsx` → `ErrorCard`) instead of a
bare line: sleepy mascot «اینترنت قطعه» + «دوباره وصل شو» + back (offline, `NETWORK`/`INTERNAL`), sad mascot «پازل‌ها تموم شد» (no puzzles), shocked
mascot (any other server error). Used by the live duel and the solo screen; other screens still show their own short error line.

## Home / Lobby screen

Laid out as **screen-home** of `docs/design/Dozari - 01 Screens.dc.html` (D99, replaces the earlier
"one row of equal mode cards"):

- **Top counters** (three pills): coins, daily-puzzle streak, level.
- **Wordmark** and a **speech bubble** under it: "today's puzzle is ready" (tap → daily puzzle) while
  it can be played, otherwise the month's mood line.
- **Corner tiles**, one column per side (54px candy squares with a label; a tile shows only when its
  feature flag is on). Right: daily reward (badge when claimable), private tables, tournaments, price
  lookup. Left: settings/profile, messages (unread badge), city chat, shop, fitting room, Bale.
- The **hero** character floating over the bazaar background. It is also the **guide** (owner note 4):
  tapping it cycles short tips (`fa.home.guide.tips`, one per menu; tips of switched-off features are
  skipped) shown in a `GuideBubble` (mascot + speech bubble) above it; the tip fades after 12 s.
- Coin pill → coin history sheet (see §Coin history sheet).
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
When the game ends the board gives way to one fixed end scene, never a scrolling page (D54): top bar,
the character (win / sad) with the result line, one dark card holding the price round (one question
at a time, then the summary) and then the chart, and the back / new-game slabs pinned at the bottom.
Short screens (≤ 700 px tall) get a smaller character and chart.

## Live duel (D99, D100)

Four views from `docs/design/Dozari - 13 Match Screens.dc.html`:

1. **screen-mode** «میدان رقابت»: the 1v1 card (picked; entry fee and winner payout from the public
   `duel.*` settings), the 2v2 card dimmed with «به‌زودی», a «رقابت با دوست» pill that opens the
   private-table sheet, and «بزن بریم!» to join the queue.
2. **screen-search** (D104, diamond background, the 4×4 grid of candidates being scanned, you vs «؟»,
   the real queue wait, «لغو جستجو») while searching; then **screen-versus**: blue half (player) and
   pink half (rival) split by a gold seam with the VS coin, both name plates (level badge + nickname),
   and a 3-second countdown leads to the board. A resumed match skips both.
3. **screen-match**: top bar (leave button — two taps, since leaving loses; the turn clock plate turns
   pink in the last 10 s; «۱ در ۱»), score panel (faces, names, four group pips per side, points,
   blue/pink tug bar), whose turn it is, a toast line (guess feedback, the rival's taunt), the board,
   the taunt button beside «فرصت‌ها», and shuffle / clear / submit. Shuffle only reorders the player's
   own view. The design's magnifier and freeze power-ups are not part of the game rules and are left out.
4. **screen-results**: the hero's win / sad / thinking pose, the banner, why it ended (worded from the
   player's side), a scoreboard (groups and points per player, crown for the leader), home and play again.

## Inbox and invite pages (D99)

- **Inbox** = screen-notifications of `19 Social Daily Onboarding`: full page with a grape header
  band, «همه خوانده شد» when anything is unread, and one card per message (candy icon tile, title,
  body, how long ago, a pink dot while unread). Tapping marks it read.
- **Invite** = screen-invite: sky-to-ink page, three cheering characters, «رفیقت بیاد، هر دو
  ببرید!» with both rewards from the server rules, the code in a dashed box with copy (web
  clipboard), «n از m دوست اومدن» with up to five boxes (the last a chest), the rules, the field for
  a friend's code, and a share slab. Per-app share buttons of the mock-up become the system share sheet.

## Friends page (D99)

screen-friends of `19 Social Daily Onboarding`, opened from the profile sheet (its button shows the
number of pending requests): sky header band, «+ افزودن» (find players), a search field that filters
by nickname, incoming requests with accept / decline, then one card per friend (avatar, nickname —
tap for their profile — and a gift button that opens the coin gift). The mock-up's online status and
per-friend duel button need presence and direct challenges, which do not exist yet; they are left out.

## City hub (D112)

screen-hub of `11 More Screens`, opened from the round map button in Home's top row (next to it, the round **wheel** button, D154, with the number of spins waiting; it is always there): «شهر دوزاری», a
hand-drawn bazaar town where every building is a game mode — برج ساعت (daily puzzle, «جدید» when
today's is open), کاروانسرا (tournaments, «زنده»), حجرهٔ بازار (solo), زورخانه (duel), قهوه‌خانه (team)
and مکتب‌خانه (propose and vote). Tap a building: its host and a short description rise from the bottom
with «ورود» (a green slab) and a close square. Team play and propose-and-vote do not exist yet: those
buildings are drawn and open the card with a disabled «به‌زودی». A mode the admin switched off is
disabled the same way. Home stays the main screen; the hub is the second way in.

## Lucky wheel (D116)

The wheel look of D111 (lamp rim, pink pointer, big «بچرخون!») is now the **post-win** wheel, not a daily reward — the daily reward
is the streak card. Opened from the duel result screen («گردونه!» with the count of waiting spins, only after a win). Slices come
from `GET /wheel`; the spin button calls `POST /wheel/spin` and the wheel turns to stop on the slice the server picked, then a prize
card shows the coins. Spec of the rules: `docs/logic/economy.md` §Lucky wheel.

## Level road and locked popup (D109)

screen-levels of `17 Chat Shop Unlocks`, opened from the profile («جادهٔ لول‌ها»): a purple night, the
yellow title plate and a cream road with one node per level (top level first, scrolled to the player's
level on open): done = gold with a tick, current = yellow with the hero waving beside it, ahead = grey
with a padlock. Cards beside a level show what it opens, from the real gates (`GET /me/levels`: hint,
personal invite code, gifts and loans, avatar change, nickname change, plus each active shop item with a
level gate). Tapping a card of a future level opens **popup-locked**: the feature, «باز می‌شود در لول N»,
the player's level and XP bar, «اینجا چی هست؟» and Ajan's line. The design's gem-unlock button has no
counterpart (no gems) and is left out. D117 adds an XP header (level, bar, claim-all), a coin card on every 5th level
(«بگیر!» → «گرفتی») and a «الان اینجایی» tag with a glowing current node.

The road is a **winding path** (D145): level 1 at the bottom, the bends alternating left / right (30 % and 70 % of the width), an S-shaped Bézier between every pair of levels, a thick brown track
with a cream centre and a dashed line, the stretch up to the player's level in gold, round nodes on the bends (the current one pulsing, the hero waving above it) and the cards on the opposite side of each
bend (`levels/roadPath.ts`).

## Leaderboard (D108)

screen-leaderboard of `11 More Screens`, opened from the Home tile «جدول»: purple chequer with a golden
glow, pink title plate, three tabs — «همه», «شهر من», «دوستان» — the podium of the top three (2nd, 1st,
3rd; gold, silver, bronze blocks), the rest as rows (rank, avatar, province badge, nickname, XP) on a
cream sheet, and the player's own row pinned at the bottom when they are outside the top 20. Tap a row
for the player's profile. Ranked by **total XP** (`GET /leaderboard?scope=all|city|friends`, top 20, the
caller's rank counted from `user_stats`). A second tab row picks the window (D123): «کل زمان» (total XP), «این هفته» and
«این ماه» — rolling 7 and 30 days, summed from `xp_events` (one row per finished game's XP, written by `PlayerStore.addGame`;
players with no XP in the window are not listed; `GET /leaderboard?scope=&period=all|week|month`). XP from before the
event log existed counts only in «کل زمان».

## Profile without scrolling, and the player card (D146)

The own profile no longer scrolls: a short caravan header (118–140 px) with the back and pencil buttons, the avatar overlapping its edge with the level hexagon, nickname, skill rank · city (province badge), the level bar, four compact stat tiles in one row, up to three earned-badge tags (+N), and the shortcuts as a grid of icon tiles (`HubTile`): جاده‌ی لول, دوستان (request count badge), نشان‌ها, بازی‌ها (recent games, now a sheet), پیدا کردن, هدیه و وام, دعوت. The pencil opens the editor (gender, nickname, city, e-mail) as a sheet that scrolls on its own. Phones under 720 px tall shrink the avatar and tiles instead of scrolling.

Another player's profile is a **player card**: the caravan header with a close button, avatar in a ring with the level hexagon, name with the online dot, skill rank and title chip, city with its province badge, four stat tiles (games / wins / losses / draws), chips for coins and member-since, up to three medals, and the actions — «درخواست دوستی» / waiting / accept for strangers; for friends a «دوست هستید» tag and round icon tiles for gift, loan, unfriend.

## Profile and settings (D107)

**screen-profile**: caravan scene header with back and a pencil (opens the editor: gender, nickname,
city, e-mail), the big avatar with the level hexagon, nickname, skill rank and city (with its province
badge), the level bar, four stat tiles (games / wins / losses / draws), the earned badges as colour
tags and shortcut buttons (friends, badges and messages, find a friend, gifts and loans, invite). The
design's handle line is left
out. Opened from the level pill on Home or from settings.

**screen-settings** (Home tile «تنظیمات»): hujre scene, sky title plate, Mashti and his line, then three
cards — «بازی» (sound, vibration, less motion as switches, per device), «من» (profile, city, install on
phone when possible, replay the tutorial) and «حساب» (about, sign out everywhere, delete with a second tap).

## Tournaments (D106)

List: orange page, one card per tournament (icon tile, title, players / entry, start time, status chip).
A tournament's page is screen-tournament of `11 More Screens`: the win scene fading into purple, status
pill, the yellow ribbon with the title, «شروع تا» live countdown, three tiles (players, entry, first
prize), the bracket as columns per round (winner ticked, live match outlined green), then a card with
story, prizes, rules, results and players; a large «ثبت‌نام» / «انصراف» slab at the bottom.

## Shop (D105)

screen-shop of `17 Chat Shop Unlocks`: the hujre scene under a dark veil, the yellow «حجرهٔ دوزاری»
plate with the coin count, four tabs (سکه، جم، کمکی، ویژه) and a two-column grid of goods. Character items (hair, hats, glasses, clothes) are not sold here: see *Fitting room* below.
Only «کمکی» has goods today (hint tokens, bought with coins; level gate and daily limit show on the
card, a locked card is veiled with a padlock); the other tabs are dimmed and say «به‌زودی» — coin
packs wait on the payment decision, gems/offers on their own features. A purchase
ends in the «مال خودت شد!» card.

## Fitting room (D179)

«اتاق پرو», a left-column Home tile (shirt icon, shown with the shop flag), after the idea of `21 Cosmetic Packs`:
the player's own character (`heroFor(gender)`) on a warm stage, the coin / gem counts, a row of what is worn
(tap a chip to take it off in the preview, «همه را دربیار» for the real thing), one tab per slot (کلاه، مو، عینک، آرایش،
لباس، زیورآلات) and a shelf of cards. Tapping a card **tries it on for free** (tapping again bares the slot; «برگردان»
drops all tries). The bottom button then does what the item allows: «بپوش» / «دربیار» for an owned item, the price
(coins or gems) to buy-and-wear, «رایگان · بپوش» for a 0 price, the toman price (Bale invoice) when real money is on,
or the guide's reason when it is locked (level, not enough coins). Prices, levels and currencies are set per item in the
admin panel. An empty slot says it is coming. The Home hero wears what is equipped (`GET /me/cosmetics`).

## City page (D101)

«شهر من», opened from the city row of the profile: the badge grid of `18 Provinces` — an «ایران»
group then «ایرانیان خارج از کشور», each card with the province badge, city name and souvenir; the
current city is yellow; «نمی‌خواهم بگویم» clears it. Tapping saves and returns. Home shows the
badge and the local greeting under the month bubble; tapping it opens the profile.

## Matchmaking queue (waiting) screen

The waiting view is screen-versus above. Still open from the original spec below: practising solo
while waiting and the queued-puzzle info.

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

## Searching for a 2v2 (D151)

In the 2v2 queue the search screen looks for **three** players, not one: the title reads «جستجوی تیم» with «یک هم‌تیمی و دو حریف پیدا می‌کنیم», and the VS panel shows you and a scanning «؟» (the teammate) against two scanning «؟» (the rivals), each disc running through the faces of the grid. When the match is found the versus screen shows both teams (you + teammate over the two rivals). `match:found` carries `youId` so the app can tell which listed player is the receiver.

## Page headers and the device's top edge (D150)

Every full-screen page puts its back button and title high: the row starts `PAGE_TOP_EXTRA` (14 px on the web, 30 native) below the top inset (`safeTop` adds the notch / status-bar inset on a home-screen web app). `PageShell` (chat/«قهوه‌خانه», inbox/«پیک», friends, tournaments/«جام‌ها», coin history, city picker) grows its coloured band by the same inset, so the white title never slips below the band onto the sand background (the bug seen on phones with a notch). The opponent search keeps «در حال جستجو…» and the seconds on one line, and its VS panel sits in the free space between the grid and the cancel button instead of floating over the last row on shorter screens.

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

**Coin history sheet** (owner note 13, 2026-10-02; replaces the earlier "no separate wallet screen"
decision): tapping the coin count on Home opens «تاریخچه‌ی سکه» — the player's own `coin_ledger`
rows, newest first, each with a Persian reason label, relative time and a signed amount
(green `+` / red `−`), plus the current balance on top and a «بیشتر» button for the next page.
Backed by `GET /me/ledger?limit=&before=` (keyset cursor `<createdAtMs>_<id>`, caller's rows only,
financial fields only: no ref ids or idempotency keys). Code: `apps/server/src/ledger`,
`apps/mobile/src/ledger`. The match-history list on Profile stays as is.

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

## Recent games on the profile (D128)

The profile lists the last 5 finished games («بازی‌های اخیر»): mode (solo / duel), outcome (win / loss / draw), XP and how long ago.
Source: `xp_events` (one row per finished game, now with `mode` and `outcome`; rows from before have neither and show as solo, no
outcome). `GET /me/games` returns the last 10, newest first, the caller's own only.

