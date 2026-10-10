# App error reports (`POST /client-errors`)

When something breaks in the player's app, the app tells the server, with a screenshot, so the admin panel («بازیکنان و نظارت ← خطاهای اپ») shows what the player saw.

- **Sources:** `ErrorBoundary` (a screen that throws while drawing: before this, the whole page went blank), the `ErrorCard` of a failed screen (kind `error` reports itself; the other cards have a «گزارش مشکل به ما» link), and uncaught errors / unhandled promise rejections (a few per session).
- **Payload** (`packages/shared/src/clienterror`): kind (`crash|screen|manual`), screen name, message, detail (stack + the trail of the last screens and failed API calls), one line of device facts, optional note and a JPEG/WebP/PNG `data:` screenshot (≤ 700 000 chars). A crash screenshot shows the crash card (the broken screen is already gone); the trail and screen name say where it happened.
- **Server:** works signed-out (a crash on the login screen still counts); keyed by user or IP, at most 8 reports per 10 minutes. Stored in `client_errors` (migration 0072). Admin: list, load one screenshot, mark checked (audit-logged).
- Never blocks the game: sending fails silently.
