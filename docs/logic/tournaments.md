# Tournaments (D60 format; owner backlog items 26, 27)

Owner (2026-10-01): a tournament can require **coins and a level** (both optional: 0 coins = free, level 1 = everyone), and the admin panel builds
tournaments with a description and their own page.

## Builder (admin «تورنومنت‌ها»)

Title, description (story/rules), size 4 / 8 / 16 / 32, minimum players to run, entry coins, minimum level, start time (registration closes then),
prizes for place 1, 2 and 3 (place 3 is paid to **both** semi-final losers). Save as a draft or publish. The builder shows the pool
(`entry × size`) against the prizes and warns when prizes exceed it: **the house funds prizes; entry fees are a sink**, so a prize larger than the pool creates
coins — the admin's call, never automatic. A tournament can change freely while a draft; once published, structural fields (size, minimum players,
entry, level) are locked as soon as one player joined (title, description, prizes may still change). Admin can start now or cancel (refunds everyone).
A start time in the past is allowed (back-dated tournaments): once open, the next tick starts it immediately (or cancels it when `min_players` is not met, unless `bot_fill` is on).
Invalid builder input returns `{ error: 'INVALID', reason }` and the admin panel shows a Persian message per `reason` (`bad_size`, `bad_title`, …).

## Entry

`POST /tournaments/:id/join`: tournament open, level ≥ `min_level`, free seat, not already in, balance ≥ entry. One transaction: ledger debit
`tournament_entry` + entry row. Leaving while open refunds (`tournament_refund`); each join/refund has its own idempotency key.

## Running

Every 20 s (`TOURNAMENT_TICK_SECONDS`) the server: starts due tournaments (fewer than `min_players` joined → cancelled and refunded), seeds by **level**
(higher first, earlier sign-up breaks ties), builds the bracket (`buildBracket`: 1 v last, 2 v last-1 … byes against the best seeds), settles byes and empty
slots, starts every ready match through the live duel service, and returns a `playing` match to `ready` if its live duel was lost (server restart).
A player in another live duel is retried on the next tick. A duel result advances the winner (`onMatchEnded`); a draw is replayed. After the final the prizes are
paid (`tournament_prize`, once per player) and the tournament finishes. A player who never shows loses by the duel's own timeout rules (consecutive timeouts).

## Player pages

«تورنومنت‌ها» on Home: list (status, seats, entry, level, start) and the tournament's own page: story, prizes, rules text, the join/leave button with the reason
when blocked, players, bracket by round (فینال / نیمه‌نهایی / یک‌چهارم نهایی …), results. Switch: `feature.tournament`.

Not built: bots filling empty seats (waits for the admin bot users, D85), scheduled recurring tournaments, notifications at each round beyond Bale text,
a live bracket push over sockets (the page refreshes every 10 s).

## One tournament at a time (D92)

By default a player may hold a seat in only one open or running tournament. Each tournament has an admin switch **allowConcurrent** («کسی که در تورنومنت دیگری هست هم بتواند وارد شود»); when on, players already in another tournament may still join this one. The check is on the tournament being joined: `join` answers `BUSY` (HTTP 409) and the detail page shows `blocked: 'BUSY'`. Store: `busyElsewhere(userId, exceptId)`; column `tournaments.allow_concurrent`.

## Sponsor

A tournament may have an admin-defined sponsor (banner and story on its page, a tag in the list): `docs/logic/sponsors.md`.
