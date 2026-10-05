# Cached pages and offline solo

Owner requests: (1) data pages should show what they had last time and update behind it, with skeletons the first time; (2) the app keeps a few
solo puzzles so the player can play without internet, and says clearly which parts need internet.

## Cached pages (stale-while-revalidate)

- `apps/mobile/src/net/swr.ts` (pure, tested): `swr(key, fetcher, onData, onError)` calls `onData(cached, true)` from the device copy (if any, fresh enough),
  then `onData(live, false)` and stores the live copy. A failed refresh is silent while a cached copy is shown; with no copy it goes to `onError`.
  `swr.refresh(key, fetcher)` is the plain live fetch that also stores the result — used for the reload after an action (a purchase, a claim) so an old copy never flashes.
- Copies are per account (owner tag = tail of the session token) and drop after `CACHE_MAX_AGE_MS` (14 days). Stored in chunks of 1 500 characters over the
  device store (`bigStore.ts`): the keychain is not meant for big values, and no extra native dependency is needed.
- Used by: leaderboard (per tab), shop, friends, profile (+ badges, recent games), badges, missions, level road, tournament list, wallet history (first page).
  Not cached: anything live (a match, a queue, chat), the daily reward, prices of a game in progress.
- First visit shows `Skeleton` placeholders (`components/Skeleton.tsx`, still when motion is reduced).

## Offline solo

- The app keeps up to `OFFLINE_PACK_SIZE` (5) whole puzzles on the phone (`offline/pack.ts`), topped up from `GET /solo/offline-pack` whenever Home is shown
  or an online solo game starts. A puzzle is used once. Level-aware like online solo (puzzle tiers).
- No connection at «بازی تکی»: a saved puzzle starts instead, played by the same pure reducer as the server (`startLocalSolo`, `localGuess`, `localShuffle`
  in `packages/shared/src/solo/local.ts`, same `SoloView`), with a note «بدون اینترنت بازی می‌کنی». Hints, the nudge, the price round and the chart are not
  available offline; the end screen says so. The daily puzzle is never offline.
- **Practice only (rule 4 exception).** The pack contains the solutions, so a client could cheat. That is acceptable only because offline games grant nothing:
  no XP, no coins, no stats, no review prompts; results are never sent to the server. (The first idea was to sync XP/coins afterwards; it was dropped for this reason.)
- The endpoint is for signed-in accounts only and capped at `OFFLINE_PACK_DAILY_LIMIT` (15 puzzles per rolling 24 h) so it cannot be used to harvest the whole pool.
- Parts that need internet show the connection-lost banner (`ServerDownBanner`) or the sleepy-mascot card; no separate offline mode for them.
