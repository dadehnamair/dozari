# Bale bot (notifications)

Owner request (2026-10-01): a bot on the Bale messenger (its bot API mirrors Telegram's, `https://tapi.bale.ai/bot<token>/<method>`) that
connects to the game and receives every notification the game wants to send. D72.

## Linking

1. In the app (Home → «اتصال به بله») the player asks `POST /bale/link-code` and gets a 6-character one-time code (valid 10 minutes,
   alphabet without look-alikes). One live code per player.
2. They send the code (or `/start CODE`) to the bot. The bot's long-poll loop calls `NotifyService.handleUpdate`, which consumes the code and stores
   `bale_links(user_id, chat_id)`. A chat links to one player and a player to one chat; a new link replaces the old one.
3. `/status` and `/stop` work in the chat; `DELETE /bale/link` unlinks from the app.

## Sending

Everything goes through the outbox table `notification_outbox` (`NotifyService.notify` / `notifyChat` / `broadcast`): rows are only created
for linked players, a dispatcher sends pending rows every 5 s, failures retry up to 5 times and are then parked as `failed`
(visible in the admin panel «ربات بله»). No push goes out when `BALE_BOT_TOKEN` is unset: rows wait in the outbox.

Notifications built so far (switchable in admin settings, group «اعلان‌های بله»):

| kind | when | setting |
|---|---|---|
| `match_result` | a live duel ends (win / loss / draw with the reason) | `notify.match_result` |
| `daily_ready` | the daily-reward cooldown of a linked player has passed (once per claim, `bale_links.daily_notified_for`) | `notify.daily_ready` |
| `broadcast` | admin sends a message to everybody linked | — |
| `test` / `admin` | admin sends a test to one chat id | — |

New notifications (friend request, tournament start, …) just call `NotifyService.notify(userId, kind, text)`.

## Config

`BALE_BOT_TOKEN` (from Bale's bot father), `BALE_BOT_USERNAME` (shown in the app), `BALE_API_BASE` (default `https://tapi.bale.ai`). Updates are
fetched by long polling, so no public URL or webhook is needed.

## Not verified

Written against the Telegram-compatible Bale API from its documentation and tested with a fake HTTP layer only; it has not talked to the real
Bale servers. Bale chat ids are assumed to be numeric.
