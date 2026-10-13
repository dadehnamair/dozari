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
- Not covered: table invites (too short-lived), match results (Bale), a logout hook that calls `stopBackgroundNotify` (not wired yet).
- **Not compiled or run yet:** the Kotlin module was written without an Android SDK; build `assembleRelease` and test on a real phone (also a Xiaomi/Huawei one, where aggressive battery managers may delay or kill the job) before relying on it.
- Optional later layer: FCM through UnifiedPush's embedded distributor for instant delivery where Google is reachable (needs an owner exception to rule 8).
