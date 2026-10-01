# Admin panel (as built)

Single-page app served at `GET /admin` (vanilla JS, no external requests, strict CSP). Login = the shared `ADMIN_TOKEN` (see `docs/security.md` for its limits).
Sections: dashboard · catalog · price review · bot inbox & sources · daily reward · users · message center · word filter · Bale bot · settings · socket service · audit log.

## Users (D74)

List with search (name or id), filter (all / new / banned), sort (last seen / newest / most coins) and paging. The detail dialog shows id, balance, dates, friend count,
private gender, Bale link, ban reason, and offers:

- coin adjustment through the ledger (`admin_adjust`, audited, never below zero),
- ban with a reason (a ban also ends every session) and unban,
- **log out everywhere**: `users.sessions_valid_after` — tokens issued before it are refused,
- rename / random new nickname + avatar (moderation of offensive names),
- private admin notes (table `user_notes`), recent coin ledger.

## App management (D74)

Settings group «مدیریت اپ» (`app.*`, `feature.*`), public through `GET /config`, picked up by the server within ~5 s and by the app at start and every 5 minutes:

- **Maintenance mode** with a message: the player API answers `503 {error:"maintenance",message}`; `/health`, `/config`, `/admin`, `/images` stay open; the duel queue refuses.
- **Minimum build** (`app.min_build`) + update link: older builds see a full-screen «update» page. `APP_BUILD` in `apps/mobile/src/config/build.ts` must be raised with every store release.
- **Feature switches**: price lookup, live duel, friends/profile, inbox, Bale link. A switched-off feature answers `503 {error:"feature_off"}` and its button disappears in the app.
- A network failure never locks players out: the app treats a missing config as "all open".
