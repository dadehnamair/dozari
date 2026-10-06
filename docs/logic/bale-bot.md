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


## Phone verification through the bot (D81, owner backlog item 6)

The player first types a mobile number in the app (`PUT /me/phone`; Iranian numbers only, stored as `+989…`, shown masked). Linking Bale
needs a number first (`phone.required_for_bale`). After the link code is redeemed the bot sends a one-tap keyboard button
`request_contact` («ارسال شماره‌ی من»). A shared contact verifies the number only when (1) the chat is linked to the player,
(2) `contact.user_id` equals the sender's Bale id — it is the sender's **own** contact, a forwarded contact proves nothing — and (3) it
matches the number typed in the app. Wrong contacts count like wrong link codes (8 per 10 min per chat). A verified number belongs to one
account (unique index); typed-but-unverified numbers are not unique, so nobody can squat a number. SMS fallback: `POST /me/phone/sms`
+ `/me/phone/verify` (5-digit code, hashed, 5 min, 60 s between sends, 5 tries); the provider is an adapter (`phone/sms.ts`); Kavenegar
`verify/lookup` is included but **not run against the live service**. Not verified against Bale's real servers: that Bale delivers
`contact.user_id` and honours `request_contact` exactly like Telegram.

## Existing account (D126)

A number is **never** silently merged or refused. Typing a number another account holds just stores it as pending (no `taken` answer, so
nobody learns who holds a number). When the player then **proves** it (Bale contact or SMS code) and another account already holds it,
`phone_conflicts` records the choice (30-minute expiry) instead of verifying:

- `GET /me/phone` carries `conflict {phone (masked), current, previous}` (nickname, avatar, level, coins of each account); the Bale bot tells
  the player to open the app. The app polls every 5 s while a number is pending, so the card appears right after the bot step.
- `POST /me/phone/resolve {choice, deviceId?}`: **keep_current** moves the number to this account (the old account keeps its data but loses the
  number, so no recovery through it); **load_previous** issues a session for the old account, makes this device belong to it (`claimDevice`, so a
  later token expiry logs in to it, not to the throw-away guest) and the app swaps its token and remounts every screen.
- Both choices ask «مطمئنی؟» first; nothing is merged and coins are never combined.


## Play from the bot: signup by contact (owner request 2026-10-05)

The landing `/download` page and footer show «بله» (admin setting `link.bale_bot`; empty = hidden). Someone who opens the bot and sends `/start`
without a link code gets a one-tap `request_contact` button. Their **own** contact (`contact.user_id` = sender id; forwarded contacts are
refused and count as wrong codes) is normalised with `normalizeIranPhone`; `NotifyService.signup` (`notify/signup.ts`) then returns the
account holding that verified number or creates a new one (random nickname, `phone` verified, no device, signup bonus like a guest) and
`NotifyStore.linkChat` links the chat. The account appears in the admin user list with phone + Bale link. The app/mini app reaches it later
through phone login (or the D126 conflict choice). Not verified against Bale's real servers (same caveat as above).

## Telegram mini app (switch is OFF by default)

Admin settings `feature.telegram_app` (0/1, default 0) and `link.telegram_app` (URL). Only when the switch is on **and** the link is set does
`/public/landing` carry `telegramApp`, and the landing shows a «تلگرام» tile (play without install, PWA-like). Nothing else of Telegram is built.
