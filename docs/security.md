# Security notes

Audit of 2026-10-01 (whole server, admin panel, sockets, dependencies). What is protected, what was fixed, what is still open.

## Protected

- **Server authoritative** (rule 4): clients never get unsolved groups, prices before the guess, or other players' secrets; all checks are server side.
- **Coins** only through the append-only ledger (rule 6); the admin coin adjustment goes through the same function and is audited.
- **SQL**: Drizzle with bound parameters only; the admin user search escapes `%` and `_`.
- **Admin XSS**: the admin SPA builds the DOM with `textContent`/DOM calls, never `innerHTML`; links stored in the database are only rendered when they are http(s) (`safeHref`), and the API refuses other schemes.
- **Sessions**: HS256 JWT, 30 days, user looked up on every request so a ban takes effect at once.
- **Tokens and secrets** are never logged (Fastify's default request log does not include headers).

## Fixed in the audit

| Finding | Fix |
|---|---|
| No rate limits anywhere | per-IP general limit (300/min), account creation (20/min), admin token (10 wrong tries / 15 min then 429), friend requests (30/h per player), wrong Bale link codes (8 / 10 min per chat), socket flood (60 events / 10 s per connection, then disconnected) |
| Admin page without CSP / security headers | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, HSTS in production, strict nonce-based CSP on `/admin`, `default-src 'none'` on JSON |
| Content bot could be pointed at internal addresses (SSRF) | http(s) only, no credentials, every hop (including redirects, followed by hand, max 4) must resolve to public addresses only, response read with a hard size cap |
| `javascript:` link as a price source | API accepts http(s) only; UI renders only http(s) |
| Internal errors leaked in 5xx responses | generic `{error:"internal"}`, details only in the server log |
| Large request bodies | 64 KB HTTP body limit, 16 KB socket message limit |
| Weak secrets could reach production | boot refuses `NODE_ENV=production` with a short/default `JWT_SECRET` or `ADMIN_TOKEN`; warns on `CORS_ORIGIN=*` |
| High-severity dependency advisories | `drizzle-orm` 0.36 → 0.45, `@fastify/static` 8 → 10 |

## Open / owner decisions

- **Admin login** now uses separate accounts with roles (D76). The static `ADMIN_TOKEN` remains as an optional break-glass owner: once an owner account exists, remove it from `.env`. Still open: two-factor sign-in, IP allow-list for `/admin`.
- **Guest account = device id.** Whoever has the device id has the account (it is a random 128-bit value kept in the device keychain). Phone-number linking (optional, profile spec) is the recovery path.
- **JWT revocation**: only bans end a session today. A "log out everywhere" switch is planned.
- **Coins are visible** on every player's public profile (D67) — owner to confirm.
- **Remaining audit advisories** (moderate): `uuid` inside Expo's build-time config plugin and two packages under `minio` (used only by the image upload script, not by the running server).
- **Rate limits are per process** (in memory). Running several server instances needs a shared store (Redis) — noted for the deploy phase.
- Set `TRUST_PROXY=1` when running behind a reverse proxy, otherwise every client looks like the proxy's IP.
