# Admin panel (as built)

Single-page app served at `GET /admin` (vanilla JS, no external requests, strict CSP). Login = username + password (or the break-glass `ADMIN_TOKEN`, see below and `docs/security.md`).
Source: `apps/server/src/admin/ui/` — `styles.ts` (design system, light/dark, RTL), `core.ts` (DOM/API helpers, modal, drawer, `ask` confirm), `kit.ts` (icons, page header, `dtable`, `seg`, `searchBox`…),
`shell.ts` (navigation tree + router + Ctrl+K palette + sign-in), `views1/2/3.ts` (pages).

## Information architecture

Seven sections in a collapsible sidebar; sections with several pages show them as tabs (`#/section/tab`). Old flat links (`#/users`) redirect. Badge counts (pending prices, bot inbox, open chat reports) show on the
sidebar and tabs.

| section | tabs |
|---|---|
| نمای کلی | dashboard: «کارهای منتظر تو» (pending prices/bot/reports, failed bot run, catalog gaps), live server stats, maintenance warning, recent changes, shortcuts |
| بازیکنان و نظارت | users · player reports · chat reports · word filter · badges · bot players · invite codes |
| محتوا و قیمت‌ها | catalog · price review · bot inbox · bot sources · **AI studio** · player suggestions (UGC) |
| بازی و پازل | puzzles · daily puzzle · level road · cities · canned taunts |
| اقتصاد | daily reward · shop · wheel · tournaments · sponsors |
| ارتباط با بازیکن | message center · Bale bot |
| سایت معرفی و لینک‌ها | blog · cast · FAQ · short links |
| سیستم | settings (searchable) · admin accounts (owner) · socket service · audit log (searchable, filter by admin) |

**Quick jump** — `Ctrl/⌘+K` (or `/`): jump to any page, toggle the theme, sign out, or search players by name/id and open the record straight away.
Users open in a side drawer with tabs (overview + avatar picker · account & contact · game & items · coins/gems · moderation · notes). «حساب و تماس» shows handle, phone (+ verified),
e-mail, device id, city, age track, privacy flags, chat unlock, Bale link and **the last device** (platform, OS version, app build, market now and market of the first install). Phone, e-mail
and device id are only returned to roles with the `users` permission (owner, support); the exact birth date stays owner-only. The user list also searches phone / handle / e-mail for those roles.
«بازی و آیتم‌ها»: XP, games/wins, gems, stock items, owned cosmetics (worn or not) and recent shop purchases.

**Last device** — the app sends `x-client-platform|os|build|store` on every API call (`apps/mobile/src/net/clientHeaders.ts`); after the response the server records them for the signed-in
player in `user_clients` (`apps/server/src/clients/`, at most once per 30 min unless something changed). The first row's store/build is kept as the install source. Client-reported: for display only.
Users open in a side drawer; destructive actions use a styled confirmation dialog instead of the browser's `confirm`.

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

## Age bands (D198, proposed, not built)

A «رده‌های سنی» section plus an age-band filter on every list; see `age-tracks.md` §Admin panel.
