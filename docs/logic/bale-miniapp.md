# Bale mini-app (D180)

Owner request (2026-10-05): the game opened **inside Bale** as a mini-app, kept apart from the main web app so it can be managed on its own:
own folder, own container, own domain. The sample from Bale (`miniapp.js`, `Bale.WebApp.initData`) only shows the SDK; the product is the real game.

## Shape

- **Same game, no second client.** The mini-app is the Expo web export of `apps/mobile` (the same bundle as `s-dozari-web`), reshaped by
  `apps/bale-miniapp/scripts/prepare-dist.mjs`: Bale's SDK (`https://tapi.bale.ai/miniapp.js`, the first script in `<head>` as Bale requires) and `bale-bridge.js` load first, the game bundle is held back
  until login is done, and the PWA parts (service worker, manifest) are dropped. Game changes reach both apps with no extra work.
- **Own container** `s-dozari-bale-miniapp` (`c-dozari-bale-miniapp`), image from `deploy/Dockerfile.bale-miniapp`, Caddy config `apps/bale-miniapp/Caddyfile`
  (no-cache page, immutable hashed bundles, no `X-Frame-Options`: Bale's web client embeds mini-apps in an iframe, so the host's reverse proxy must not add one either). Loopback `BALE_APP_PORT` (8084); the host's proxy forwards `BALE_APP_DOMAIN` to it.
  Set that address as the mini-app URL in Bale's bot father.
- **Login** `POST /auth/bale-miniapp {initData}` (only when `BALE_BOT_TOKEN` is set): the signature is checked like a Telegram web app
  (HMAC-SHA256 of the sorted lines, key = HMAC("WebAppData", bot token); `auth_date` at most 24 h old). The Bale user id maps to a fixed device id
  (`HMAC(bot token, id)`, 32 hex), so the same Bale user always gets the same account, on any phone, and a later 401 re-login (the game's guest flow) lands on it too.
  The bridge stores `dozari.token` and `dozari.deviceId` where the game reads them. Outside Bale (no `initData`) the page just starts the game as a guest.
- **CORS**: the compose file adds `https://BALE_APP_DOMAIN` to the server's `CORS_ORIGIN`.

## SDK features in use (all in `bale-bridge.js`, the game itself is untouched)

| Feature | What it does |
|---|---|
| `ready()` / `expand()` | loading screen ends at once, full-screen |
| `setHeaderColor('#2B1240')` | Bale's header matches the game's purple |
| `openLink(url)` | external links (`window.open` of http(s) outside our origin) open in Bale's browser |
| `?startapp=solo\|daily\|duel` | `https://ble.ir/<bot>?startapp=daily` opens that screen (mapped to the game's `?go=`) |
| `isMiniAppSupported` | an old Bale app gets a Persian «update Bale» notice instead of a blank page |

Not wired yet (need game-side work): BackButton (needs in-memory routing, Bale's own warning), closing confirmation during a live duel, `requestContact` for phone proof (the verified path stays the bot's `contact.user_id == from.id` check), theme (the game keeps its own look).

## Payments inside the mini-app (`openInvoice`)

Shop items bought with money (`payWithMoney`, D170; coin packages have the same route) use Bale's payment page when the game runs in the mini-app:

1. `POST /shop-pay/:id/bale-invoice-link` (and `/coin-packages/:id/bale-invoice-link`) → server builds the same invoice as the bot flow and calls Bale's
   `createInvoiceLink`; answers `{link}` (`503 payments_unavailable` without `BALE_PROVIDER_TOKEN`).
2. The game calls `Bale.WebApp.openInvoice(link, cb)` (`apps/mobile/src/bale/miniapp.ts`); the callback status `paid | cancelled | failed | pending` picks the
   line shown (`shop/payNote.ts`); `paid` reloads the shop.
3. Credit is unchanged: only Bale's `successful_payment` credits (ledger, idempotent). The callback is only for the screen, never for the credit.
4. **No bot link needed.** `pre_checkout_query` normally maps the paying Bale user to a player through the linked chat; a mini-app player has no link, so
   `NotifyService.miniAppUserOf` also maps `from.id` → `baleDeviceId(botToken, id)` → account. Only the Bale user the account was created for can pay its invoice.
5. Outside the mini-app nothing changes: the invoice goes into the linked chat.

CORS: the compose file also allows the `null` origin, because Bale's web client may sandbox the iframe (opaque origin). The API authenticates with bearer tokens only
(no cookies), so a CORS allow-list is not what protects it. If `localStorage` is unusable there, the bridge installs an in-memory one.

## Not verified

Written from Bale's documentation and the Telegram-compatible scheme; never run inside the real Bale client. To check on first deploy: that `initData`
is signed with the bot token exactly as above, that `Bale.WebApp.ready()/expand()` exist, and that the web view keeps `localStorage` between opens.
Bale-specific extras (back button, share, in-app payments through `openInvoice`, see `bale-payments.md`) are not wired into screens yet.

## Tests

`apps/server/src/__tests__/bale-miniapp.test.ts` (signature, device id, route), `bale-payments.test.ts` (invoice link, mini-app payer) and `node --test apps/bale-miniapp/scripts/prepare-dist.test.mjs` (page rewrite).
