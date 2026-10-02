# Open work — state at 2026-10-02 (end of session 01YBi3YgeezPWzWpm7QVi62M)

For the next chat. Read `CLAUDE.md`, `docs/HANDOFF.md`, then this file. `docs/PLAN.md` boxes are partly stale: several phase 4–6 items are built but not ticked — verify in code before building.

## Merged this session (PR #91)
Post-win lucky wheel (D116) · level road coin rewards every 5 levels + hint-pack shop tiers at levels 10 / 20 / 35 (D117) · animated scenes (clouds, lantern glow, palm; `components/sceneMotion.tsx`) · duel socket renews a stale token · admin: pending badges refresh, campaign invite codes (valid example, optional name) · iPhone home-screen app safe areas.

## A. Pending from this session
1. **iPhone safe area, round 2 (unmerged branch/PR):** art now runs full-bleed under the status bar and home indicator; screens add `safeTop()` / `safeBottom()` (`theme/safeArea.ts`). Only checked in Chromium with simulated insets. Still without safe areas: full-screen sheets that do not use `PageShell` (leaderboard, tables, transfers, invite, Bale, review…). Verify on a real iPhone (remove + re-add the PWA).
2. **Deploy:** `up -d --build`; `migrate` must end `exited (0)` (new tables `wheel_spins`, `level_reward_claims`; ledger reasons `wheel_spin`, `level_reward`).
3. **Economy simulation** for the wheel (≈13 coins/spin) and the level road (1375 coins to level 50): two new faucets, numbers are guesses.
4. **Admin panel:** the «در انتظار» (prices / bot inbox) list shows a count but an empty list — owner has not sent the count, role and `/admin/catalog` / `/admin/bot/candidates` response. More panel issues were hinted at, not listed.
5. **Scene animations:** lantern glow is subtle (opacity .55–1, radius ±3); owner may want it stronger. Owner said further lamp/tree animations exist in their design — only what is in `docs/design/Scene.dc.html` (commit `ddfe658`) is ported.
6. **Level road polish:** S-shaped path + stars of the design, tap on past cards, entry from the Home level pill, non-hint shop goods (outfits/avatars need a currency decision).
7. **Wheel:** only duel wins against a human spin; none for solo/team/bot wins (documented). Gems do not exist.
8. **Bale bot:** never run against real Bale servers; check `BALE_BOT_TOKEN` / `BALE_BOT_USERNAME` reach the `server` service in `docker-compose.prod.yml`. **Content bot (scraper):** no real source configured, never run on live data.

## B. Owner's 16 notes still open (`HANDOFF.md`)
4 guide character on Home explaining the menus · 6 price lookup busier, by category · 7 soft app-wide music · 11 «why is this locked» guide · 13 coin history (`GET /me/ledger` + sheet) · 3 other players' profile is plain.

## C. Older asks not built
Phone login (needs account-recovery decision) · public player number + default handle (`dozari_7k2m`) · Bale payment docs · gems/outfits/avatars shop tabs · week/month leaderboards · team 2v2 and propose-and-vote · recent games on profile · contacts screen in the app · private-table chat and shared tables (backlog 16, 17, 18, 21, 23) · trend-based daily puzzle (15) · native sound, city backgrounds, touch-everything polish (F).

## D. PLAN.md phases still open
- **Content (critical):** only one starter product exists. Need 60 products × ≥3 price points, 50–100 hand-curated puzzles, group titles, generator, pre-generation job (`seed/images` is empty).
- **Result & share:** share card (`react-native-view-shot` + `expo-sharing` are not in the code), share from the result screen, competitive price-guess UI.
- **Teams:** 2v2 model, queue, proposals; `user_tags` and equipped tag.
- **UGC:** `ugc_submissions`, `ugc_votes`, submit/vote UI, reward on approval.
- **Economy leftovers:** bot subsidy plumbing checks, price-guess wager.
- **Launch hardening:** error tracking (self-hosted), analytics (self-hosted), 500-match load test, Cafe Bazaar / Myket listing + Persian privacy policy, backups + restore drill.
- **Phase 0-A risks:** self-hosted OTA, registry reachability from Iran, realtime latency.
- **Admin:** word-filter section, wire remaining settings to their consumers.

## E. Owner decisions needed
Gems currency (and what it buys) · random daily reward · real-money coin packages on/off · account recovery for phone login · prize tables of the wheel and level road.

## Suggested order
Content seed → admin-panel issues → share card → economy simulation → notes 13 / 4 / 11 → launch hardening.
