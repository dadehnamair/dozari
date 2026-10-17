# Group game (the bot plays inside Bale / Telegram groups)

Owner request (2026-10-17, D244): add the bot to a group and play the puzzle right there, together, then pull the players into the app.
Bale first; Telegram runs on the same code (ids carry the `tg:` prefix, `docs/logic/bale-bot.md`). Group chats never link a player account.

## Phases
1. **Daily puzzle in a group** (built): join, `/play`, cooperative board with inline buttons, one play per group per day, app call-to-action.
2. Weekly group leaderboard `/top` (built). Private-table card `/table CODE` (built, see §Table card).
3. Price mode `/price` (built, see §Price mode).
4. Admin stats and the funnel from group links to new accounts (built, see §Funnel).

## Joining
- The bot is added to a group → `my_chat_member` (status `member`/`administrator`) → row in `bot_groups` and a welcome message with the commands.
  Leaving/being kicked (`left`/`kicked`) → `removed_at` set and any live round dropped.
- Not every host sends `my_chat_member` (Bale is not verified), so the first command seen in a group registers it too (`/start`, `/play`, `/help`).
- A chat is a group when `chat.type` is neither `private` nor `channel`; a missing type means private (the old flow is untouched).
- Privacy: the bot reads only commands and button taps in groups, never ordinary messages.

## Commands (a `@botname` suffix is ignored)
`/start` · `/help` welcome and rules · `/table CODE` card for a private table · `/play` today's puzzle · `/price` price questions · `/top` this week's best members of the group.

## Rules of the round
- The puzzle is **today's daily puzzle** (`DailyService.ensure`, same as in the app), 16 cards, 4 groups of 4. Cooperative: the whole group shares one board,
  one selection and one pool of mistakes (`SOLO_MAX_MISTAKES`). Pure logic is `startSolo` / `submitGuess` from shared; the server holds the solution
  and only solved/revealed groups ever appear in a message (rule 4).
- One message is edited in place. Buttons: the cards still on the board (4 per row; the taps toggle a ✅ on that card), then «ثبت» (needs exactly 4),
  «پاک کردن», «بُر زدن». Callback data is `g:<rev>:<action>` (`t<index>` | `s` | `c` | `h`); `rev` bumps on every change, so a tap made on a stale
  board is refused with a toast and the board is redrawn (positions shift after each solved group).
- Whoever taps submit is named in the note under the board («سارا یک گروه پیدا کرد 🟩» / «یکی مونده بود 🔥» / «اشتباه بود»). Players are counted per tapper id.
- **One play per group per Tehran day** (`bot_group_plays` primary key `(chat_id, date_key)`). `/play` during a live round re-sends the board (the old
  message stops answering). A play left `playing` after a server restart is restarted by the next `/play` (mistakes reset: same trade-off as the app's daily).
  After it finished, `/play` answers with the result and the app call-to-action instead of a new puzzle.
- No coins are given in groups (rule 6: coins only via the ledger, and the install is the prize). Group results never touch any player's stats.
- Rounds are in memory, dropped after `GROUP_ROUND_TTL_MS` idle.

## Weekly leaderboard (`/top`)
- A member earns points when the submit they tapped finds a group: `groupPoints(level)` = 10 + 5 × level (yellow 10 .. purple 25); a wrong or one-away submit
  adds one to their `wrong` count and no points (nobody is punished, but ties go to the fewer-wrong player). Groups the game reveals at the end earn nothing.
- The week is named by its Saturday (`groupWeekKey`, Tehran date key); per `(chat, week, member)` one row, updated by an increment. Member = the messenger
  user id of the tapper plus their first name as last seen. Only that group's members are listed; there is no global ranking.
- Order (`rankGroupScores`): points, groups found, fewer wrong, name. `/top` shows `GROUP_TOP_SIZE` rows; an empty week invites `/play`.
- Constants in `packages/shared/src/config/groupgame.ts`.

## Price mode (`/price`)
- A session is `GROUP_PRICE_ROUNDS` four-choice price questions («قیمت X در سال Y؟», options from `buildPriceOptions`, same draw as the app's price-only mode:
  distinct products, a random priced year). One message per question with four option buttons (`p:<question>:<option>`; the option index, never a price).
- Everyone in the group may answer, **once per question** (the first tap locks; no edit of the message per tap, only a toast «جوابت ثبت شد»). After
  `GROUP_PRICE_ROUND_MS` the message is rewritten with the real price and who was right/wrong, and after `GROUP_PRICE_PAUSE_MS` the next question follows. The real
  price is in server memory only until that reveal (rule 4). Taps after the reveal, on an older question message or a wrong question index are refused with a toast.
- Scoring: a right pick earns `GROUP_PRICE_POINTS` into the same weekly tally as the puzzle (`/top`); a wrong pick earns nothing and counts in `wrong`. (The app's
  staircase is not used: with four choices every pick would earn something and tapping blindly would pay.) After the last question the bot posts the session's
  top three and the app call-to-action.
- At most `GROUP_PRICE_SESSIONS_PER_DAY` sessions per group per Tehran day (`bot_group_price_sessions`, an atomic counter); more is answered with the app
  call-to-action. One session at a time per group. A server restart drops a running session (its already revealed points stay saved; the daily count stays used).
- Timers are in memory (`schedule` is injected so tests drive them).

## Table card (`/table CODE`)
- A player opens a private table in the app (it has a 5-character code) and writes `/table CODE` in the group. The bot answers with a card — host, table name, format,
  seats taken, entry fee, code — and a URL button «ورود به میز 🎮» → `https://ble.ir/<bot>?startapp=table_<CODE>_g<ref>` (Telegram: `https://t.me/...`).
  The code is the secret that lets someone post a table, exactly as it is in the app; a card shows public facts only (`TableService.card`: no player ids).
- `TableService.card(code)` gives nothing (the bot says «پیدا نشد») for an unknown, expired, locked, full or playing table, and **never for a family table**.
  Without the bot's username there is no link, so no card. A malformed code (alphabet or length) gets the usage text. At most 3 cards per group per minute.
- Mini-app bridge: `table_<CODE>(_g<ref>)?` → `?go=table&code=<CODE>` (the code is shape-checked in the bridge and again in the game) and keeps `g<ref>` as the link source.
  The game (`pwa/logic.ts tableLaunchOf`, `usePwa.takeTableCode`, `App.tsx` → `HomeScreen openTableCode`) opens the table sheet on that code once; the sheet then
  joins through the normal `POST /tables/:code/join`, so every ordinary check applies (age track, family, guardian, leave ban, lock, full, coins). A guest account is
  made on the way, like any first visit. A shared link on an old app build just opens Home.
- Not built: a «share to group» button inside the app (the host writes `/table CODE` by hand), and a card that updates its seat count.

## Call to action
The finishing message (and the «already played today» answer) carries a URL button «ادامه در بازی» → mini-app deep link
`https://ble.ir/<bot>?startapp=daily_g<ref>` (Telegram: `https://t.me/<bot>?startapp=daily_g<ref>`) built from `BALE_BOT_USERNAME` / `TELEGRAM_BOT_USERNAME`
(no button without a username). Text sells what only the app has: more puzzles, duel 1v1/2v2, price chart, keepsake cards.

## Funnel (phase 4)
- Each group has a short opaque code `bot_groups.ref` (7 chars of `[a-z2-9]`, unique, made the first time the group is seen) so the link says which group it
  came from without exposing the chat id. The button link is `?startapp=daily_g<ref>`; the bare `?startapp=daily` keeps working.
- Mini-app bridge (`apps/miniapp/miniapp-bridge.js`, `applyStartParam`): `(solo|daily|duel)(_g<ref>)?` opens the screen as before and keeps `g<ref>` in
  `localStorage['dozari_src']` (in-memory shim when storage is blocked: then the visit is simply not attributed).
- The game's request headers (`apps/mobile/src/net/clientHeaders.ts`) add `x-client-src: g<ref>` (web only, shape-checked). The server (`clients/info.ts`) reads it
  with the other client headers into `user_clients.src` (latest link source) and `first_src` (set only when the account's row is first created, like `first_store`):
  **a new account counts as «from a group» only when its very first call carried the code**; an existing player opening a group link only moves `src`.
  Client-reported, display-only, never used for access.
- Admin «گروه‌های ربات» (`/admin/stats/groups?days=`, `admin/group-stats.ts`, view `botgroups` in `ui/views2/stats.ts`): groups (total/active/per messenger/new), group plays and
  players in the window, price sessions, the funnel (new accounts from group links → played at least one board (`puzzle_plays`) → active in 7 days; all-time new and
  touched), plays per Tehran day and the top 30 groups with their own referred accounts. Bots are not counted.
- Not measurable: people who tap the button but never create an account, and the Telegram/Bale in-app browser that blocks storage. Link clicks are not logged (a
  Telegram/Bale URL button is opened by the host, not by us).

## Abuse limits
Per tapper `GROUP_TAP_LIMIT` taps per minute; a message edit that Bale/Telegram rejects (`message is not modified`, deleted message) is swallowed.
Config in `packages/shared/src/config/groupgame.ts`.

## Data (migrations 0097, 0098, 0099, 0100)
- `bot_groups(chat_id PK, platform, title, ref unique, added_at, removed_at)`; `user_clients.src`, `user_clients.first_src` (migration 0100).
- `bot_group_price_sessions(chat_id, date_key PK, sessions)`.
- `bot_group_scores(chat_id, week_key, user_ref PK, name, points, groups, wrong)`.
- `bot_group_plays(chat_id, date_key PK, result playing|won|lost, mistakes, solved_groups, players, started_at, finished_at)`.

## Not verified
Bale's `callback_query`, `editMessageText` with an inline keyboard, URL buttons and `my_chat_member` follow Telegram's shape but have not been
tried against the live Bale API; first run on a real group must confirm them (the code tolerates a missing `my_chat_member`).
