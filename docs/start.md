# Getting started — run and test Dozari on a fresh machine

End-to-end guide: clone, set up, run, and walk through every playable feature. Docker-free
(see `LOCAL-DEV.md` for the short version, `ARCHITECTURE.md` for the stack).

## 0. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22 (`.nvmrc`) | `nvm use` |
| pnpm | 9+ | `corepack enable` |
| MySQL | 8 | native install (XAMPP/Laragon/`brew`/`apt`); Docker optional (`docker compose up -d`) |
| Browser | any modern | Expo **web** is the quickest way to try the app |
| Phone (optional) | Expo Go | same Wi-Fi as the computer |

## 1. Clone and install

```bash
git clone https://github.com/dadehnamair/dozari.git
cd dozari
git checkout main && git pull
pnpm install
cp .env.example .env
```

## 2. Database

```sql
CREATE DATABASE dozari CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'dozari'@'%' IDENTIFIED BY 'dozari';
GRANT ALL ON dozari.* TO 'dozari'@'%';
```

Edit `DATABASE_URL` in `.env` if your credentials differ. Then apply every migration (there are
many — `0000` … `0028` at the time of writing; a partial schema produces confusing 500s):

```bash
pnpm --filter @dozari/db db:migrate
pnpm --filter @dozari/db seed                # idempotent
pnpm --filter @dozari/db images:upload       # seed/images/* -> .local/images, served at /images/*
pnpm --filter @dozari/db demo:puzzle         # 16 fake demo-* products + 1 approved puzzle (dev only)
```

`demo:puzzle:remove` deletes the demo data again. `seed:check` only validates the seed JSON.

> Seeded price points marked `pending` are never served. Without real approved puzzles only the
> demo puzzle is playable; solo and daily play both draw from approved puzzles.

## 3. `.env` for local testing

Defaults work for the server. Add/adjust:

```ini
ADMIN_TOKEN=dev-admin          # legacy token login for /admin
CORS_ORIGIN=*                  # needed for Expo web (browser). Use a precise origin outside your own machine.
# JWT_SECRET=...               # required only when NODE_ENV=production
```

Optional (all off/unset by default, features degrade gracefully): `BALE_BOT_TOKEN`,
`BALE_BOT_USERNAME`, `BALE_API_BASE`, `IRNOTI_API_KEY`, `IRNOTI_MESSAGE` (SMS; preferred), `KAVENEGAR_API_KEY`,
`KAVENEGAR_TEMPLATE` (SMS fallback), `S3_*`.

## 4. Run

Two terminals:

```bash
pnpm --filter @dozari/server dev      # API + sockets on http://localhost:3000
pnpm --filter @dozari/mobile start    # press `w` for web, or scan the QR with Expo Go
```

Check: `curl localhost:3000/health`.

**On a phone** `localhost` is the phone itself — start Expo with the computer's LAN IP and open
port 3000 in the firewall:

```bash
# macOS / Linux / Git Bash
EXPO_PUBLIC_API_URL=http://<LAN-IP>:3000 pnpm --filter @dozari/mobile start
```

```powershell
# Windows PowerShell (the variable cannot go after `pnpm --filter ...`; set it first)
$env:EXPO_PUBLIC_API_URL="http://<LAN-IP>:3000"
pnpm --filter @dozari/mobile start
```

Find the LAN IP with `ipconfig` (IPv4 address of the Wi-Fi adapter). The variable lives only in
that terminal session; set it again in a new one.

If the app says «اتصال به سرور برقرار نشد», it prints the address it tried. Check, in order:
`/health` opens in a browser → `CORS_ORIGIN` is set and the server was restarted (web only) →
LAN IP/firewall (phone only).

> Putting the game on a real server: `docs/deploy.md` (production compose, https, migrations, backups).

### Install as an app (PWA)

The web build is an installable PWA (D98). Installing needs **https** (or `localhost`); over a plain
`http://<LAN-IP>` address the phone can play in the browser but shows no install option.

```bash
pnpm --filter @dozari/mobile build:web     # -> apps/mobile/dist (static files)
```

Serve `apps/mobile/dist` from any https static host (or an https tunnel to your machine), open it on
the phone, then: Android Chrome → menu → **Install app**; iPhone Safari → Share → **Add to Home Screen**.
Set `EXPO_PUBLIC_API_URL` to the public API address before building, and allow that web origin in the
server's `CORS_ORIGIN`. The app also shows its own «نصب» card on Home (and «نصب روی گوشی» in the
profile); on iPhone it explains the Safari steps (D102).

Hosting rules for `dist/` (any static host; nginx shown):

```nginx
location = /sw.js              { add_header Cache-Control "no-cache"; }          # releases must be seen
location = /manifest.webmanifest { types { application/manifest+json webmanifest; } add_header Cache-Control "no-cache"; }
location /_expo/static/        { add_header Cache-Control "public, max-age=31536000, immutable"; }
location /                     { try_files $uri /index.html; add_header Cache-Control "no-cache"; }
```

`build:web` stamps `dist/sw.js` with a build version and the precache list, so each release replaces
the old cache; players see «نسخهٔ تازهٔ دوزاری آماده است» on Home and update with one tap (never
mid-match). Home-screen shortcuts open solo, daily puzzle or duel (`/?go=…`).

## 5. Admin panel

Open `http://localhost:3000/admin`.

- Quick: paste `ADMIN_TOKEN` (`dev-admin`).
- Real accounts (roles `owner|editor|support|viewer`):

```bash
NEW_ADMIN_PASSWORD='a-long-password' pnpm --filter @dozari/server admin:create alice owner "Alice"
```

```powershell
# Windows PowerShell
$env:NEW_ADMIN_PASSWORD="Dozari-Test-2026"
pnpm --filter @dozari/server admin:create alice owner "Alice"
```

The password must be at least 10 characters, must not contain the username, and needs at least 5
distinct characters (otherwise `WEAK_PASSWORD`). Arguments: username, role, display name.

Everything tunable lives in **Settings** (feature flags, daily caps, economy, timers). Changes
apply without a restart.

## 6. Test checklist

Screen and menu names below are approximate (UI strings live in `apps/mobile/src/i18n/fa.ts`).

Open the app in **two browser profiles** (or one normal + one incognito window) wherever a step
says "second player" — each profile is a separate guest identity.

### Solo and daily
1. Home → **Solo**: pick 4 cards, submit; check correct / one-away / wrong feedback, 4 mistakes
   end the game, shuffle, hints (cost coins).
2. After the game: price-guess round, then the price chart panel.
3. Home → **Daily puzzle**: one attempt per day; the daily reward card grants coins once per day.
4. Admin → Settings → `limit.solo_per_day = 1`; a second solo game must be refused with the
   daily-cap message. Set back to `0` (no cap).

### Onboarding, profile, account
5. First launch of a new profile shows the **tutorial** (skippable; can be reopened from settings).
6. Profile sheet: nickname/avatar, sound/vibration/reduce-motion toggles, **About**.
7. **Sign out everywhere** invalidates every token of that user; **Delete account** anonymizes the
   profile (ledger and history stay), bans the shell, and a fresh guest is created on the same device.

### Live duel (needs two players, or one + the bot fallback)
8. Both profiles: Home → **Duel** → **«بزن بریم!»** on the mode screen. They pair up (versus card, 3 s countdown); otherwise a bot joins after the fallback timer
   (which player is a bot is never shown).
9. Take turns; wrong guesses and timeouts count; watch scores, mistakes, lock-outs.
10. Taunt buttons (`chat:taunt`) are canned phrases. Free-text chat needs an invite code
    redeemed (`users.chat_unlocked_at`).
11. Close the tab mid-match, reopen: Home shows **back to your game**; it resumes the same match.
12. Coins: the first `duel.free_per_day` duels are free (reduced payout); then the entry fee is
    taken, the winner gets the pot minus `duel.house_cut_percent`, a loss pays a capped
    consolation, and a broke player gets one rescue per day. Verify under Admin → Users → ledger.
13. Admin → Settings → `limit.duel_per_day = 1`: a second duel is refused.

### Private tables
14. Player A: **Tables → create**; a 5-character code appears (no `0/O/1/I/L`).
15. Player B enters the code; A starts; both land in a friendly match (no coin stakes).
16. Share the table to city chat; the card in chat has a **Join** button.
17. Idle tables close after `table.idle_minutes`. `feature.tables = 0` hides the feature.

### Tournaments
18. Admin → Tournaments: create one (entry fee, prize split, start time). Join from the app.
19. By default a player can be in only one tournament at a time (`BUSY`); tick
    **allow concurrent** on a tournament to lift that for it.

### Economy / shop
20. Daily reward, hint purchase, balance on Home update live; every change is one row in
    `coin_ledger` (append-only).
21. **Coin packages** are OFF by default (`feature.coin_packages`) until store accounts and
    receipt keys exist — do not expect real purchases.

### Admin
22. Content: products, price points (approve/reject; >5× jumps flagged), puzzles, candidates inbox.
23. Moderation, support inbox, audit log, accounts and roles, settings registry.

## 7. Automated checks

```bash
pnpm -r typecheck && pnpm -r lint && pnpm -r test
```

DB-touching behaviour is covered with in-memory stores in unit tests; the MySQL implementations
need the real database from step 2.

## 8. Known gaps (so you don't chase them)

- Mobile screens haven't been exercised on a real device; only the web build and unit tests.
- Real SMS (irnoti: set `IRNOTI_API_KEY`; or Kavenegar), Bale bot, store receipts (Bazaar/Myket) and push are not live without keys.
- WebAudio sounds are web-only; native sound is not built.
- Price-guess round inside duels, 2v2 tables and admin 2FA are not built yet (`PLAN.md`).

## 9. Troubleshooting

| Symptom | Likely cause |
|---|---|
| 500 on a new feature | a migration is missing — rerun `db:migrate` |
| Solo says no puzzle | no approved puzzle — run `demo:puzzle` or approve one in admin |
| Images missing | `images:upload` not run, or `LOCAL_IMAGES_PUBLIC_URL` not reachable from the client |
| Duel never pairs | only one client, wait for the bot fallback timer; check the console for socket errors |
| Web app blocked by browser | `CORS_ORIGIN` unset |
| `/admin` is 404 | `ADMIN_TOKEN` unset and no admin account exists |
