# Matchmaking, rooms & connection handling

No rating/ELO at launch (D12). Values in `config/game.ts`.

## Queues (in-memory for MVP, Redis later)

- `duel` queue: FIFO of `{userId, joinedAt}`. Pair the two oldest compatible entries.
- `team` queue: entries are **parties** of 1 or 2. Form a match from parties totalling 4 players, filling
  sides so parties stay together (2+2, 2+1+1, 1+1+1+1).
- Compatibility: both can afford the entry fee (checked at join AND re-checked at match start), not
  mutually blocked, not in another active match.
- *QUEUE_BOT_FALLBACK_SECONDS* = 60 (superseded default — see `docs/logic/bots.md` for the
  actual `BOT_FALLBACK_SECONDS`, proposed 20–40s): once a real player has waited this long with
  no human match, an **undisclosed AI opponent ("bot")** fills the match instead (D23, owner
  request 2026-09-27). The waiting screen still offers "play solo while waiting" alongside this.

## Opponent-search show (D144)

While a player waits, the search screen's 4×4 grid scans through real faces: `GET /duel/candidates` returns up to 16 `{nickname, avatarKey, level}` — players online right now first (shuffled, never the caller), topped up from the active bot roster when few are online, so the grid is never empty while bots exist (it falls back to the design's placeholder names only when there are none). Bots and humans are indistinguishable and nothing says who is online. A few faces repeat around the grid. The app refreshes the list every 12 s. It is a show: the queue alone decides who the match pairs with.

## Match start sequence

1. Queue pops players → create `matches` row (`waiting`) and socket room `match:<id>`.
2. Pick puzzle unseen by all participants (puzzle-generation.md §Infinite).
3. **Escrow entry fees** via LedgerService (one transaction; idempotency key per user). If any fails →
   abort, refund others, requeue the rest at their original position.
4. Send `match:found` → clients show opponent(s) → *READY_TIMEOUT* = 10 s for `match:ready`.
   Missing ready → abort + refund, the no-show gets a short queue cooldown (*NO_SHOW_COOLDOWN* = 60 s).
5. `active`: first turn goes to a random side (seeded; stored in match_events).

## Search reveal card (D40/D41)

The matchmaking wait screen doesn't show a bare spinner: while `queue:status` waits, the client
cycles through nicknames/avatars drawn from the same-looking player pool, then "locks onto" the
actual opponent from `match:found`'s payload once it arrives — including a bot opponent, per D23.
Owner: "موقع انتخاب حریف یسری کارت بیاد که داره از تو اسم‌های مختلف یکی رو پیدا میکنه که این حس و
نده کسی نیست" و "از تو اون کارت‌ها مثلا ربات با اسم و مشخصات واقعی وارد میشه." No server/protocol
change — this is purely how the client renders the existing wait period; the cycling pool can be a
static/cached recent-players sample, not a live query. Prototype: `prototype/screens/queue.html`.

## Private tables (میز اختصاصی)

- Host creates: `{format: '1v1'|'2v2', entryFee}` → 5-char room code (alphabet without 0/O/1/I/L),
  expires after *ROOM_IDLE_MINUTES* = 15 without start.
- Deep link `dozari://room/<CODE>` and web URL `https://<domain>/r/<CODE>`.
- Joiners pick a side; host can swap/kick; host starts when seats are full. Entry fee escrowed at start.
- Rematch keeps the same room.
- **Host ownership features (D52)** — beyond the bare controls above: a custom table name + emoji
  the host picks, an explicit board-difficulty selector for the table (ties into D47/D51 — harder
  boards cost more to enter), and a "require every guest to confirm ready before start" toggle.
  Owner: "موقع ایجاد میز یکم امکانات بیشتر بدیم به سازنده که حس مالکیت رو بهش القا کنیم." Prototype:
  `prototype/screens/table.html`.

### Built so far (D93)

`apps/server/src/tables/*` (in-memory like live matches), routes `POST /tables`, `GET /tables/mine|:code`, `POST /tables/:code/join`, `/tables/leave|start|ready|lock|extend|kick|share`; gate `feature.tables`; setting `table.idle_minutes`.
Table = 1v1, name + emoji, optional "guest must be ready", host lock/kick/extend, the table stays for rematches, closes when idle. **Friendly only** (no entry fee, no payout) because duel coin escrow is not built;
board difficulty and 2v2 are not built either. 2v2 tables (D142): `POST /tables {format:'2v2'}` makes a four-seat table; players get a team (0/1) on joining — the emptier team, on a tie the second, so a third joiner is the host's teammate — and `POST /tables/side {side}` moves a seated player to the other team when it has room (`FULL`, `NOT_TEAM` at a 1v1 table). The host starts when both teams have two players (`NEED_PLAYERS` otherwise; `requireReady` needs every guest ready); the match is `MatchService.startTeam`, friendly (no stakes). `TableView` carries `format`, per-player `side` and `isYou`.
`share` posts a join card (`chat_messages.kind = 'table'`, text `CODE|emoji name`) into the host's city chat; tapping it opens the table.
The app has no live duel board yet, so a started table match is only playable once the duel client exists.

## Reconnects & abandonment

- Server keeps the match authoritative; a disconnect does not pause the clock.
- *RECONNECT_GRACE_SECONDS* = 60: a returning client sends `match:resume {matchId}` and receives a full
  redacted snapshot.
- Missing the grace window, or explicit leave → that player is `abandon`.
  - Duel: opponent wins.
  - Team: if one teammate remains, team continues (captaincy passes). Both gone → other side wins.
- Abandoners get no payout and their entry fee goes to the pot (sink); repeated abandons → queue cooldown.
- **Resume-match indicator (D42)**: as soon as the app opens with an unfinished match still active
  server-side (i.e. still inside `RECONNECT_GRACE_SECONDS`, or a longer-lived "match still active"
  state — exact cutoff TBD), the client shows a persistent badge/banner (Home screen, and ideally a
  nav-level badge) offering to rejoin — not just "reconnect works if you happen to navigate back
  into the match." Owner: "اگه بازی رو باز داشتم و افتادم بیرون، موقع برگشت یه آیکن بگه هست و
  می‌تونه دوباره بپیونده." Prototype (client-only flag, no real server round-trip):
  `prototype/index.html` sets `gh_active_match` in localStorage on duel start/clears it on
  finish/abandon; `prototype/screens/home.html` reads it and shows the banner.
- **Mid-match takeover** — see `game-rules.md` §Mid-match disconnect → bot takeover (D43): past
  `BOT_TAKEOVER_GRACE_SECONDS` (proposed 15s, D62), an AFK/disconnected seat gets a silent bot
  takeover rather than staying abandoned, same undisclosed-bot policy as D23.

## Presence & social

- **Online player count** (D45): shown somewhere persistent (Home header, matchmaking wait screen)
  — a real or lightly-smoothed server-computed figure, never fabricated client-side. Needs a
  lightweight presence mechanism (could piggyback on the existing socket connection count) — not
  designed yet, tracked as an open item.
- **Browse players & friend requests** (D44) — see `profile-and-identity.md` §Friends & player
  browsing.

## Socket events (contract lives in `packages/shared/src/socket/events.ts`)

Client → server (all with ack `{ok:true,...}|{ok:false,error}`):
`queue:join {mode, partyId?}`, `queue:leave`, `party:create`, `party:join {code}`,
`room:create {format, entryFee}`, `room:join {code}`, `room:seat {side}`, `room:start`,
`match:ready`, `match:submit {itemIds}`, `match:propose {itemIds}`, `match:resume {matchId}`,
`match:leave`, `match:rematch`, `chat:send {channel, tauntId?|text?}`.

Server → client:
`queue:status {position, waitedSec}`, `match:found {matchId, players}`, `match:state <ClientView>`
(full redacted snapshot, sent on every change — boards are tiny, no diffing needed),
`match:event <MatchEvent>` (for animations: guess result, turn change), `match:ended {result, payout, solution, chart}`,
`chat:message`, `error`.

Auth: JWT in the socket handshake `auth.token`. One active socket per user; a new connection
replaces the old one.

## As built (v1, duel only)

`apps/server/src/realtime/match-service.ts` runs live 1v1 matches in memory around the shared reducer. The gateway hands every
queue pair to `MatchService.start`, which loads two public profiles and a random approved puzzle, then pushes `match:found` and
`match:state` to both players. `match:submit {itemIds}`, `match:resume {matchId}` and `match:leave` are answered with acks; every
change pushes a redacted `match:state` plus `match:event`s, and the end pushes `match:ended` with the full solution. The turn clock
is one timer per match for the current turn (a stale fire is ignored by `turnId`); an AFK player is ended by the reducer's
consecutive-timeout rule. A player who connects with a live match gets the snapshot immediately.

Not built yet: entry-fee escrow and payouts, the price-guess round, the ready handshake, reconnect grace and bot takeover,
persistence of the match log, level (everyone is level 1 on the opponent card).

## Live duel in the app (D94)

`apps/mobile/src/duel/*`: `socket.ts` (socket.io-client with the guest token, events parsed with the shared zod schemas), `model.ts` (pure reducer, unit-tested), `DuelScreen.tsx` (queue → board → result, turn clock, own-guess flash, sounds).
Home button «دوئل زنده» (`feature.duel`). A private table's match opens the same screen in resume mode (`match:resume` without a match id → the server re-sends the current snapshot).
Also: canned-taunt buttons (socket `chat:taunt`, the opponent's taunt shows for 4 s) and the «برگشت به بازی در جریان» button on Home from `GET /match/active` (D42).
Not in the app yet: price-guess round inside a duel.
