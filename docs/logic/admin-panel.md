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

## Admin accounts and roles (D76)

Each admin has an account (`admin_users`: username, display name, scrypt-hashed password, role, active flag). Sign in at `/admin` with username and password (`POST /admin/login`
→ 8-hour signed session, kept in `sessionStorage`, sent as `x-admin-token`). The old static `ADMIN_TOKEN` still works as a **break-glass owner** ("توکن اصلی"; no personal audit
name) — create an owner account, then remove `ADMIN_TOKEN` from `.env`. First owner without a token: `NEW_ADMIN_PASSWORD='…' pnpm --filter @dozari/server admin:create <username> owner "name"`.

| role | may |
|---|---|
| viewer | read everything except the admin-account list |
| support | + players (ban, log-out, rename, notes) |
| editor | + catalog, prices, bot, word filter, messages/broadcast (not players, not money) |
| owner | everything: coins, daily reward, settings (maintenance, feature switches), Bale test, admin accounts |

Enforced in one place (`permissionFor(method, path)` → permission → role check, deny by default: an unknown write needs `system`). Password policy: ≥10 characters, not containing the
username, not trivially repetitive. 5 wrong passwords lock the account for 15 minutes; 10 failed sign-ins per IP block the IP for 15 minutes. A password change, a role change or a
deactivation ends that admin's sessions (`session_version`). The last active owner cannot be demoted or deactivated (unless the break-glass token is configured). The audit log names the
admin behind every change.
