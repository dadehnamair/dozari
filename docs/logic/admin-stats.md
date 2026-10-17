# Admin stats: installs, gameplay, per-player puzzles (D241)

Admin section «آمار نصب و بازی» (`apps/server/src/admin/ui/views2/stats.ts`), three tabs. All numbers exclude bot accounts.

## Installs and markets (`installs`)
- Source: `user_clients` (one row per account, see `data-model.md`). `installChannel()` (`admin/usage-stats.ts`) maps a row to a channel:
  `bazaar` | `myket` | `bale` (Android, by `first_store`), `direct_android` (no market tag), `ios`, `pwa` (web build running installed:
  `x-client-pwa: 1`, i.e. `display-mode: standalone` or iOS `navigator.standalone`) and `web` (browser tab).
- Per channel: total, new in 1/7/30 days (by `first_seen_at`), active in 1/7 days (by `updated_at`); app builds per channel; accounts now on a different
  market's build than the one they were first seen in; new accounts per Tehran day (30 days). Accounts without a device row are shown as "unknown".
- A PWA row is classified by its **current** state: a browser user who later installs the PWA moves from `web` to `pwa`, and their `first_seen_at`
  stays the first visit. The numbers are client-reported (display only, never used for access).
- Not available: store-side download counts (Bazaar/Myket do not expose them through an API we can call); see the markets' own panels.

## CafeBazaar release status (`/admin/stats/bazaar`)
`admin/bazaar-monitor.ts` calls the Pishkhan API (`BAZAAR-PISHKHAN-API.md` in the repo root) with `CAFEBAZAAR-PISHKHAN-API-SECRET: $BAZAAR_PISHKHAN_TOKEN`
— only the three read endpoints `last-published`, `last-committed`, `last-uncommitted` — and shows version, size, staged rollout, auto-publish and changelog.
Cached 5 minutes (the API answers 429 when polled hard). Without the env var the tab says it is not configured. Uploading and committing releases stay out of the app.

## Gameplay (`gameplay`, `players`)
- Source: `puzzle_plays`, one row per player per finished board: `mode` (`solo`, `daily`, `duel`, `team`), `outcome`, `groups_solved` (found by the player; a group revealed by
  the game does not count), `mistakes`, `hints_used`. Written by `plays/log.ts`: solo and the daily puzzle from `SoloService.onFinished`, 1v1 and 2v2 from the match
  `onEnded` / `onTeamEnded` hooks (the board in play when the match ended; side-wide mistakes; no hints in duels). Fire-and-forget: a failed insert never affects a game.
- `puzzle_id` has no foreign key: deleting a puzzle keeps the players' history. History starts when the table was added; older games only exist in `user_stats` / `xp_events`.
- Totals per window (7/30/90/365 days): boards, players, distinct puzzles used vs. the library (and how many were never played), groups found, mistakes, hints, win/loss/draw,
  a 0-4 groups histogram, per-mode split, boards per Tehran day, the ten most-played puzzles. The player table is sortable (plays, wins, groups, mistakes, hints, distinct puzzles, recent).
- Endpoints (all `read` permission): `GET /admin/stats/installs`, `/admin/stats/gameplay?days=`, `/admin/stats/players?days=&limit=&sort=`, `/admin/stats/bazaar`.
