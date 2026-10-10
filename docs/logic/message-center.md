# Admin message center

Owner request (2026-10-01): one place in the admin panel to send and manage messages to players over Bale, SMS, e-mail, push and an in-app place. D73.

## Model

`admin_messages` (title, body, audience: all / bale_linked / one user, sent time, retracted time) + `admin_message_channels` (message × channel × recipients)
+ `inbox_messages` (one row per player per message, `read_at`). No array/JSON columns.

## Channels

| channel | state | note |
|---|---|---|
| `in_app` | works | rows in `inbox_messages`; the app shows them behind the mail icon on Home (`GET /inbox`, `POST /inbox/:id/read`, `POST /inbox/read-all`) |
| `bale` | works when the bot is configured | goes through the Bale outbox (`bale-bot.md`), only to players who linked Bale |
| `sms` | not available | no phone number is collected yet (profile-and-identity.md: optional phone link) and no SMS provider is wired (Kavenegar / SMS.ir / Ghasedak, D18) |
| `email` | not available | no e-mail is collected and no mail service is wired |
| `push` | not available | FCM is forbidden (CLAUDE.md rule 8); an alternative provider has to be chosen first |

Unavailable channels are shown disabled in the panel with the reason, and the API rejects them (`channel_unavailable`) — nothing pretends to send.

## Admin

Panel section «مرکز پیام»: compose (title, text, audience, channels), history with per-channel recipient counts, and «پس گرفتن از صندوق» which hides the
message from every inbox (messages already delivered on Bale cannot be recalled). Every send and retract is in the audit log.

## Not built

Scheduled sends, templates, audience filters beyond the three above (city, level, inactive players), per-player opt-out per channel.

## SMS provider, texts and test (D218)

Panel section «پیامک» (comms): pick the provider (`auto` = env behaviour, `irnoti`, `kavenegar`, `off`) and its key, edit the text of each OTP message
(`login` / `verify` / `delete`; `{code}` is required, ≤ 300 chars) and send a real test SMS (code `12345`, 5 per minute). Server: `apps/server/src/phone/smsConfig.ts`
(`SmsGateway`, an `SmsClient` that reads the config on every send); routes `GET|PUT /admin/sms`, `PUT /admin/sms/texts/:purpose`, `POST /admin/sms/test`
(changes need the `system` permission). Keys live in `app_settings` under `sms.*`, deliberately outside `SETTING_DEFS` so they never reach `/config` or the
settings tab, and the API only returns a mask. Kavenegar sends the template approved in its own panel, so the texts apply to irnoti only.
Broadcast SMS (the `sms` channel above) is still unavailable.
