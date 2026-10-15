# Web notifications (PWA) — D232

Local browser notifications for the installed web app, with no push service (rule 8: no Google FCM).

- The Bale sheet («بازیت رو نگه دار») has a button that asks the browser for permission (must come from a tap). States: `unsupported` (native, old browsers), `default`, `granted`, `denied`.
- `connectNotices` (Home's quiet socket) hands each live notice to `showWebNotice`. It shows a notification through the service-worker registration only when `document.visibilityState === 'hidden'` and permission is `granted`; otherwise the in-app toast/badge is enough.
- Texts live in `fa.webNotify`; `noticeNotification` (pure, tested) maps a notice to title/body/tag. Tags keep two invites from replacing each other.
- `sw.js` `notificationclick` focuses an open window or opens `/`.
- Limit: the socket dies when the OS suspends the page, so nothing arrives with the app closed. That needs Web Push (FCM on Chrome) and is not built; Bale remains the out-of-app channel.

## Android background check (D232)

No push service and no permanent service. `modules/background-notify` (local Expo module, Kotlin) schedules an AndroidX WorkManager periodic job (15 min minimum; Android batches it, so expect 15–30+ min, longer in Doze). Each run calls `GET /me/pending-notices?after=<cursor>` (`apps/server/src/notify/pending.ts`: unread inbox messages from the last 3 days + waiting friend requests, max 20, rate-limited 20/h/player) and shows the items it has not shown before (ids remembered on the device, last 200). Opening Home calls `startBackgroundNotify` (asks `POST_NOTIFICATIONS` on Android 13+, hands over the API address and the login token; the timer is kept). An expired token or any error ends the run quietly; the next app open refreshes the token.

- Works on every phone that can reach our server, including ones without Google Play Services. It is a delay-tolerant check, not instant push.
- Checks never announce an event twice or lose one: nothing is shown while the app is in front (the ids are marked seen); an event is marked seen only when the notification was really posted (with Android 13+ notifications refused it stays pending and the cursor does not advance); and a push (FCM or IRNoti) for the same kind of event that arrived since the last check suppresses the announcement (`Notifier.notePush`, per kind, device clock). Known edge: if two friend requests arrive and only the first gets a push, the second is skipped by that check.
- Debug: `adb logcat -s DozariWorker` prints one line per check (`items / shown / skipped / held`).
- Not covered: table invites (too short-lived), match results (Bale), a logout hook that calls `stopBackgroundNotify` (not wired yet).
- **Not compiled or run yet:** the Kotlin module was written without an Android SDK; build `assembleRelease` and test on a real phone (also a Xiaomi/Huawei one, where aggressive battery managers may delay or kill the job) before relying on it.
- Optional later layer: FCM through UnifiedPush's embedded distributor for instant delivery where Google is reachable (needs an owner exception to rule 8).

## Private messages (D232)

A friend's private message used to reach nobody unless that DM was open (the DM view polls every 3 s). Now `ChatService.onDirect` (not called for table cards) pushes a live notice `dm {from}` to the friend if online (Home toast + browser notification while hidden) and queues a Bale `chat_message` if offline (once per sender per 10 min, switchable per player). A friend's profile has a «پیام» button that opens `DmSheet` directly, no chat tab needed. Not yet: unread counter/badge on Home, and tap-to-open of the toast.

## Web Push for closed/suspended web apps (D232) — iPhone included

An iPhone suspends a home-screen web app in the background, so its socket and local notifications stop; only a server push wakes it. **Web Push (VAPID)** does this: on iPhone it goes through Apple's service (iOS/iPadOS 16.4+, the app must be added to the Home Screen and opened from that icon), on Chrome through Google's. Rule 8 is about app dependencies; this was accepted by the owner for push (2026-10-13).

- Server: `notify/webpush.ts` (`WebPushService`, table `web_push_subscriptions`, `GET /push/config`, `POST /push/subscribe|unsubscribe`). Needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`npx web-push generate-vapid-keys`); without them the feature is off. Dead subscriptions (404/410) are deleted.
- Which events: friend request, private message, table invite, inbox message — everything that reaches `LiveNotices.push`, plus `also` for offline players (private messages, inbox, capped at 500 per broadcast). Table requests/answers stay in-app.
- Client: `syncWebPush` (after the permission is granted and on every Home open) subscribes and registers; `sw.js` `push` handler shows the notification (silent when the app is in front, because iOS demands one per push). Same `tag` as the local notice, so one event never shows twice.
- Not verified: no real iPhone/Chrome test; needs HTTPS and the VAPID keys on the server. If a push is not shown on iPhone, check iOS ≥ 16.4, the app opened from the Home Screen icon, notification permission, and the server log for a 4xx from `web.push.apple.com`.

## Android app: FCM (D232)

Instant delivery for the native app where Google is reachable; the WorkManager check above stays as the fallback. The owner accepted FCM **for push only** (2026-10-13): no Firebase Auth, Analytics or other Firebase products.

- Server (`notify/fcm.ts`): FCM HTTP v1 without any SDK (OAuth token from the service-account key with `node:crypto`, cached; data-only high-priority messages `{title, body, tag}`), table `fcm_tokens`, `POST /push/fcm` and `/push/fcm/remove`. Env `FCM_SERVICE_ACCOUNT_JSON` (JSON text or file path); off without it. Same events as Web Push (`LiveNotices.also`). A token FCM calls 404 is deleted.
- App: `modules/background-notify` starts Firebase by hand from manifest meta-data (`plugins/withFcm.js`; build env `FCM_PROJECT_ID`, `FCM_APP_ID`, `FCM_API_KEY`, `FCM_SENDER_ID` — no google-services.json). `DozariMessagingService` shows the notification unless the app is in front; `onNewToken` re-uploads. JS (`startBackgroundNotify`) fetches the token on each Home open and posts it.
- No duplicates: FCM and the polling check show under the same notification tag (`friend_request`, `inbox`, `dm:<name>`…).
- A phone without Play Services (or with Google blocked) gets no token and keeps only the polling check.
- **Not compiled or run:** written without an Android SDK. Needs a real build (`assembleRelease`), a Firebase project with an Android app `ir.dozari.app`, and a test on a phone.

## Android app: push through IRNoti (D233, owner request 2026-10-14)

The owner wants Android push to go through the IRNoti push service, not our own FCM sender. IRNoti holds the Firebase service account; the app uses the official IRNoti Android SDK (`com.github.irnoti:andriod-sdk:1.0.1` from JitPack — the repo is spelled «andriod»).

- Panel (once): organisation → project → enable the **Push** service → new app with the Firebase service-account JSON (`/panel/projects/<id>/push`). Copy the public key `pk_live_…` and the app's numeric id. Create an API key with scope `broker.write`.
- Server (`notify/irnoti-push.ts`): env `IRNOTI_PUSH_APP_ID` + `IRNOTI_API_KEY` (+ optional `IRNOTI_BASE_URL`). Same events as Web Push; each is `POST /v1/sdk-apps/<id>/send` with `target.externalIds = [playerId]` and `extra.tag`. `GET /push/irnoti` tells the logged-in app its external id (the player id). When this is on, the direct FCM sender (`FCM_SERVICE_ACCOUNT_JSON`) is not started.
- App: build env `IRNOTI_PUSH_APP_KEY` (+ optional `IRNOTI_API_BASE`, SDK default `https://api.irnoti.ir/v1/sdk`) plus the four `FCM_*` Firebase identifiers (the SDK reads the FCM token, so Firebase still has to start; `plugins/withFcm.js`). `plugins/withIrnoti.js` adds JitPack and the meta-data; `IrnotiInit` starts the SDK; `DozariMessagingService` is the only FCM service (the SDK's is removed from the merged manifest) and passes IRNoti payloads (`irn_id`) to `Irnoti.handleMessage`, and tokens to `Irnoti.onNewToken`. `startBackgroundNotify` calls `Irnoti.identify(playerId)` on every Home open; `stopBackgroundNotify` calls `Irnoti.logout()`.
- Without `IRNOTI_PUSH_APP_KEY` the build falls back to the direct-FCM route above.
- The IRNoti SDK is compiled only with `-Pdozari.irnoti=true` (module `background-notify`: `src/irnoti` has the real `IrnotiBridge`, `src/noIrnoti` a no-op one). It is off by default in Gradle (the `Android APK` workflow turns it on) because `com.github.irnoti:andriod-sdk:1.0.1` fails on JitPack (the repository has no `gradlew`); turn it on once IRNoti publishes a working version or an `.aar`.
- Known: IRNoti notifications use the SDK's renderer (notify id from the message), so an event shown by both the push and the WorkManager check can appear twice. Not compiled or run (no Android SDK here); `compileSdk` must be 35+.
