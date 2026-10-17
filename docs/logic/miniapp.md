# Mini-app (D180)

Owner request (2026-10-05): the game opened **inside a messenger** as a mini-app, kept apart from the main web app so it can be managed on its own:
own folder, own container, own domain. Bale is the first host; Telegram uses the same scheme, so the code and docs say «mini-app», and a messenger's name
appears only where something is truly that messenger's (Bale payments, the Bale bot). The sample from Bale (`miniapp.js`, `Bale.WebApp.initData`) only shows the SDK; the product is the real game.

## Shape

- **Same game, no second client.** The mini-app is the Expo web export of `apps/mobile` (the same bundle as `s-dozari-web`), reshaped by
  `apps/miniapp/scripts/prepare-dist.mjs`: Bale's SDK (`https://tapi.bale.ai/miniapp.js`, the first script in `<head>` as Bale requires) and `miniapp-bridge.js` load first,
  the game bundle is held back until login is done, and the PWA parts (service worker, manifest) are dropped. Game changes reach both apps with no extra work.
- **Own container** `s-dozari-miniapp` (`c-dozari-miniapp`), image from `deploy/Dockerfile.miniapp`, Caddy config `apps/miniapp/Caddyfile`
  (no-cache page, immutable hashed bundles, no `X-Frame-Options`: web clients embed mini-apps in an iframe, so the host's reverse proxy must not add one either).
  Loopback `MINIAPP_PORT` (8084); the host's proxy forwards `MINIAPP_DOMAIN` to it. Set that address as the mini-app URL in the messenger's bot father.
  (`BALE_APP_DOMAIN` / `BALE_APP_PORT` from the first release still work as fallbacks.)
- **Login** `POST /auth/miniapp {platform?: 'bale'|'telegram', initData}` (`platform` defaults to `bale`; a platform is on only when its bot token is set:
  `BALE_BOT_TOKEN`, `TELEGRAM_BOT_TOKEN`): the signature is checked the Telegram-web-app way (HMAC-SHA256 of the sorted lines, key = HMAC("WebAppData", bot token);
  Bale's docs word the key step the other way round, so both orders are accepted; `auth_date` at most 24 h old). The messenger user id maps to a fixed device id
  (`HMAC(bot token, "dozari-<platform>-miniapp:<id>")`, 32 hex), so the same messenger user always gets the same account on any phone, and a later 401 re-login (the
  game's guest flow) lands on it too. The Bale text is the one of the first release, so earlier accounts keep working; Telegram has its own id space. The bridge stores
  `dozari.token` and `dozari.deviceId` where the game reads them. Outside a messenger (no `initData`) the page just starts the game as a guest.
- **Which messenger?** Bale's SDK also reads Telegram-style launch data, so inside Telegram `window.Bale.WebApp.initData` can be filled and the page cannot tell by itself
  (this was the `401 bad_signature` seen in Telegram: Telegram's data was checked with Bale's token). The bridge therefore posts `platform: 'auto'`; the server tries every
  platform that has a token and answers `{platform}` for the one whose bot signed it. The bridge then stores that in `window.__MINIAPP__.platform` and `miniapp/host.ts`
  picks the matching SDK from it. An explicit `platform: 'bale'|'telegram'` is still checked against that bot only.
- **Telegram:** its SDK (`https://telegram.org/js/telegram-web-app.js`) is loaded in the background when `tgWebAppData` is in the address (gives up after 4 s); a Bale launch
  never waits for it, a Telegram launch waits for it (at most 4 s) after login. Header colour, links, back button, start parameter and closing confirmation work through the same calls; in-app payment does not
  (the only payment path is Bale's wallet, below).
- **CORS**: the compose file adds `https://MINIAPP_DOMAIN` to the server's `CORS_ORIGIN`, and the server adds the `null` origin itself whenever a mini-app login is on (web clients
  may sandbox the iframe, whose requests carry `Origin: null`). The API authenticates with bearer tokens only (no cookies), so a CORS allow-list is not what protects it.
  If `localStorage` is unusable in that iframe, the bridge installs an in-memory one.

## SDK features in use (the bridge and a few hooks; the game screens are untouched)

| Feature | What it does |
|---|---|
| `ready()` / `expand()` | loading screen ends at once, full-screen |
| `setHeaderColor('#2B1240')` | the host's header matches the game's purple |
| `openLink(url)` | external links (`window.open` of http(s) outside our origin) open in the messenger's browser |
| `?startapp=solo\|daily\|duel` | `https://ble.ir/<bot>?startapp=daily` opens that screen (mapped to the game's `?go=`) |
| `BackButton` | the header back button shows while a screen or sheet can go back and runs the same handler as the phone's back button (`nav/backStack.ts`, filled by `useHardwareBack` on the web; `miniapp/useMiniAppBack.ts`); on Home it hides |
| `enableClosingConfirmation()` | while a live match is on screen, closing the mini-app asks «are you sure?» (`duel/LeaveGuard.tsx`) |
| `isMiniAppSupported` | an old Bale app gets a Persian «update the app» notice instead of a blank page |

**Leaving a duel.** In a live match the back button (and the phone's) does what the pause button does: the first press only asks («دوباره بزن تا از بازی بیرون بری»,
a loss is counted), the second leaves. Not wired: theme (the game keeps its own look).

Inside a mini-app the phone-only gate (D171, «بازی را نصب کن» card) is skipped: `usePhoneGate` treats it like the «ادامه با مرورگر» choice.

## Phone proof inside the mini-app (`requestContact`)

Telegram-style, from inside the bot: on the phone step (`PhoneStep`) a mini-app player sees «تأیید با بله». It calls `WebApp.requestContact(cb)` (`miniapp/host.ts`);
the host asks the player to share their own contact with the bot, and the bot receives an ordinary `contact` message. `NotifyService.handleContact` maps the sender's
Bale id to the mini-app account (`miniAppUserOf`, same as payments) and `PhoneService.verifyByOwnContact` verifies the number: only when `contact.user_id == from.id`,
nothing has to be typed first, no SMS is spent, and a number held by another account becomes the usual keep/load choice. The app only re-reads `/me/phone` (polling while
it waits). Without a mini-app account for that Bale id the old paths stay (linked chat + typed number, or bot signup). Outside a mini-app, or on a host without
`requestContact`, the button is hidden. **Not verified against Bale's real client** (written from the Telegram API; Bale's docs were unreachable): check that
`Bale.WebApp.requestContact` exists and that its callback/contact message match.

## Payments inside the mini-app (Bale `openInvoice`)

Shop items bought with money (`payWithMoney`, D170; coin packages have the same route) use Bale's payment page when the game runs as a Bale mini-app:

1. `POST /shop-pay/:id/bale-invoice-link` (and `/coin-packages/:id/bale-invoice-link`) → server builds the same invoice as the bot flow and calls Bale's
   `createInvoiceLink`; answers `{link}` (`503 payments_unavailable` without `BALE_PROVIDER_TOKEN`).
2. The game calls `openInvoice(link, cb)` (`apps/mobile/src/miniapp/host.ts`); the callback status `paid | cancelled | failed | pending` picks the
   line shown (`shop/payNote.ts`); `paid` reloads the shop.
3. Credit is unchanged: only Bale's `successful_payment` credits (ledger, idempotent). The callback is only for the screen, never for the credit.
4. **No bot link needed.** `pre_checkout_query` normally maps the paying Bale user to a player through the linked chat; a mini-app player has no link, so
   `NotifyService.miniAppUserOf` also maps `from.id` → `miniAppDeviceId(botToken, id)` → account. Only the Bale user the account was created for can pay its invoice.
5. Outside a Bale mini-app nothing changes: the invoice goes into the linked chat.

## Not verified

Written from Bale's documentation and the Telegram-compatible scheme; run in a real Bale web client (login works) but the Telegram path, Android, in-app payment and the
back button are not checked against the real clients. First-deploy checks: that `initData` is signed as above, that `ready()/expand()` exist, that the web view keeps
`localStorage` between opens, and that Telegram's launch data arrives as `tgWebAppData`.

## Tests

`apps/server/src/__tests__/miniapp.test.ts` (signature, device ids, both platforms, `auto`, route, CORS), `telegram-bot.test.ts` (Telegram client, two-bot sender), `bale-payments.test.ts` (invoice link, mini-app payer),
`apps/mobile/src/nav/__tests__/backStack.test.ts` and `node --test apps/miniapp/scripts/prepare-dist.test.mjs` (page rewrite).
