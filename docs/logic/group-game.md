# Group game (the bot plays inside Bale / Telegram groups)

Owner request (2026-10-17, D244): add the bot to a group and play the puzzle right there, together, then pull the players into the app.
Bale first; Telegram runs on the same code (ids carry the `tg:` prefix, `docs/logic/bale-bot.md`). Group chats never link a player account.

## Phases
1. **Daily puzzle in a group** (built): join, `/play`, cooperative board with inline buttons, one play per group per day, app call-to-action.
2. Weekly group leaderboard `/top` (built). The private-table deep link is **not built**: a table needs a signed-in host and the mini-app has no `startapp=table_<code>` mapping yet; until then the call-to-action opens `?startapp=duel`.
3. Price-guess mode in groups.
4. Admin stats: groups, plays, players, funnel to installs.

## Joining
- The bot is added to a group → `my_chat_member` (status `member`/`administrator`) → row in `bot_groups` and a welcome message with the commands.
  Leaving/being kicked (`left`/`kicked`) → `removed_at` set and any live round dropped.
- Not every host sends `my_chat_member` (Bale is not verified), so the first command seen in a group registers it too (`/start`, `/play`, `/help`).
- A chat is a group when `chat.type` is neither `private` nor `channel`; a missing type means private (the old flow is untouched).
- Privacy: the bot reads only commands and button taps in groups, never ordinary messages.

## Commands (a `@botname` suffix is ignored)
`/start` · `/help` welcome and rules · `/play` today's puzzle · `/top` this week's best members of the group.

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

## Call to action
The finishing message (and the «already played today» answer) carries a URL button «ادامه در بازی» → mini-app deep link
`https://ble.ir/<bot>?startapp=daily` (Telegram: `https://t.me/<bot>?startapp=daily`) built from `BALE_BOT_USERNAME` / `TELEGRAM_BOT_USERNAME`
(no button without a username). Text sells what only the app has: more puzzles, duel 1v1/2v2, price chart, keepsake cards.

## Abuse limits
Per tapper `GROUP_TAP_LIMIT` taps per minute; a message edit that Bale/Telegram rejects (`message is not modified`, deleted message) is swallowed.
Config in `packages/shared/src/config/groupgame.ts`.

## Data (migrations 0097, 0098)
- `bot_groups(chat_id PK, platform, title, added_at, removed_at)`.
- `bot_group_scores(chat_id, week_key, user_ref PK, name, points, groups, wrong)`.
- `bot_group_plays(chat_id, date_key PK, result playing|won|lost, mistakes, solved_groups, players, started_at, finished_at)`.

## Not verified
Bale's `callback_query`, `editMessageText` with an inline keyboard, URL buttons and `my_chat_member` follow Telegram's shape but have not been
tried against the live Bale API; first run on a real group must confirm them (the code tolerates a missing `my_chat_member`).
