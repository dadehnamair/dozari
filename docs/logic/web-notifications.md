# Web notifications (PWA) — D232

Local browser notifications for the installed web app, with no push service (rule 8: no Google FCM).

- The Bale sheet («بازیت رو نگه دار») has a button that asks the browser for permission (must come from a tap). States: `unsupported` (native, old browsers), `default`, `granted`, `denied`.
- `connectNotices` (Home's quiet socket) hands each live notice to `showWebNotice`. It shows a notification through the service-worker registration only when `document.visibilityState === 'hidden'` and permission is `granted`; otherwise the in-app toast/badge is enough.
- Texts live in `fa.webNotify`; `noticeNotification` (pure, tested) maps a notice to title/body/tag. Tags keep two invites from replacing each other.
- `sw.js` `notificationclick` focuses an open window or opens `/`.
- Limit: the socket dies when the OS suspends the page, so nothing arrives with the app closed. That needs Web Push (FCM on Chrome) and is not built; Bale remains the out-of-app channel.
