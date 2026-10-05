# Decisions (ADR log) & open questions

Status values: **accepted** (from the brief or confirmed by the owner), **proposed** (default chosen
by Claude to unblock work — owner may override), **superseded**.

When the owner confirms or changes a proposed decision, update the status here and adjust the
matching spec in `docs/logic/`.

## Decisions

| # | Decision | Status | Rationale |
|---|---|---|---|
| D1 | No Firebase / Google Cloud | accepted | Filtering + sanctions in Iran (brief). |
| D2 | React Native (Expo) over Flutter | accepted | JS ecosystem, AI-assisted coding, single language with Node backend (brief). |
| D3 | Custom Node.js + Socket.io + Postgres (now MySQL, see D63) backend instead of self-hosted Supabase | proposed | Brief allowed both. Custom backend keeps game logic in one TS codebase, fewer moving parts to self-host (Supabase = ~10 containers), realtime match logic needs a custom authoritative server anyway. Revisit if admin/CRUD needs explode. |
| D4 | Drizzle ORM | proposed | Pure TS, no engine binary download (Prisma engines download can fail from Iran). |
| D5 | Prices stored as integer **rials** (`BIGINT`), displayed as toman | proposed | Brief says "toman, nominal". Rial integers avoid fractional toman for very old prices (e.g. 5 rials = 0.5 toman) and are unambiguous across the new-toman redenomination. Display layer converts. Nominality is unchanged. |
| D6 | Years stored as Solar Hijri integers | proposed | Content & players think in شمسی ("سال ۷۵"). |
| D7 | Guest accounts first, phone OTP optional | proposed | Brief: entry must be completely free/frictionless. |
| D8 | **Shared board, alternating turns** for competitive matches | proposed | Brief says gameplay is turn-based/slow; a shared board makes it a real head-to-head (steal groups from the opponent) and gives 2v2 teams something to coordinate on. Alternative (parallel race on separate boards) documented in `logic/game-rules.md` §Alternatives. |
| D9 | Coin amounts per `logic/economy.md` defaults | **accepted** (2026-09-27) | Brief left formula open (open question 1). Owner confirmed the launch defaults as-is, on the condition every number stays a config value (never hardcoded) so they're tunable post-launch. All values in `packages/shared/src/config/economy.ts`. |
| D10 | Free chat gated by *redeemed* invite code; canned taunts for everyone | accepted | Brief. Visibility details in `logic/chat-and-access.md` are **proposed**. |
| D11 | Group titles are witty/indirect; hidden rule is objective and machine-checkable | proposed | Title = flavor (brief), rule = what validator checks. Keeps "infinite puzzles" solvable & fair. |
| D12 | No ELO at start; FIFO queue with widening wait | accepted | Brief. |
| D13 | Expo (React Native) ships **web (PWA) as a first-class target**, not just Android | accepted | Owner-approved tech consult (2026-09-26). iOS distribution from Iran is impractical (no Apple developer account, unreliable alt-stores); web covers iPhone users and makes invite/room-code links openable without installing anything — important for the growth loop. |
| D14 | **Build and OTA-update pipeline is self-hosted**, not EAS cloud | accepted | Same consult. EAS (Expo's cloud build/update service) may be unreachable or account-restricted from Iran. Use local builds (`expo prebuild` + Gradle, or `eas build --local`) and a self-hosted `expo-updates` server for OTA. |
| D15 | Chart library: hand-rolled `react-native-svg`, no Skia-based chart lib | accepted | Same consult. Skia-based chart libraries (e.g. Wagmi/Reanimated-Skia charts) are heavy on the web build; SVG works identically across Android and web. Supersedes the `victory-native` option listed in ARCHITECTURE.md §Stack — keep as fallback only if hand-rolled SVG proves insufficient. |
| D16 | Primary server hosting **inside Iran** (ArvanCloud or ParsPack), with off-country backups | accepted | Same consult. During international connectivity outages, only in-country services stay reachable; in-country hosting also lowers latency for the target audience. Backups replicated outside Iran for disaster recovery. |
| D17 | Evaluate **Colyseus** as an alternative to hand-rolled Socket.io room/match logic | proposed | Same consult. Colyseus is a purpose-built Node multiplayer room framework (matchmaking, state sync, reconnection) that could remove custom code from `MatchmakingService`/`MatchService`. Time-boxed to ~1 day of spike (Phase 0-A, experiment 2) before committing; plain Socket.io (current ARCHITECTURE.md default) remains the fallback if Colyseus doesn't fit the turn-based/redaction model cleanly. |
| D18 | Iranian-first vendor list for payments, SMS OTP, error tracking, analytics, push, ads | accepted | Same consult. Payments: Cafe Bazaar/Myket IAP (Poolakey) for in-app purchases, ZarinPal (needs Enamad) for web. SMS OTP: Kavenegar, SMS.ir, Ghasedak. Error tracking: self-hosted GlitchTip (not Sentry SaaS/Crashlytics). Analytics: self-hosted Umami or PostHog. Push (if built): Pushe or Najva. Ads (if/when monetization is decided, see open question 4): Tapsell, Adivery. |
| D19 | Add a **price-guess bonus round** after every puzzle (solo: 5-tier staircase scoring; competitive: blind-simultaneous, closest-wins, 4 rounds) | accepted | Owner request (2026-09-27), resolves open question "رقابت قیمتی" — a guess-the-exact-price mode was referenced in the brief's market research but never designed as a mode. Folded into the existing puzzle flow rather than a separate top-level mode. Full spec: `docs/logic/price-guess-round.md`. |
| D20 | Nickname & avatar are **gallery-picked only** (never free text), random at signup, customization unlocks at 3 games (avatar) / 10 games (nickname) | accepted | Owner request (2026-09-27). Removes free-text nickname moderation risk entirely; the play-count unlock is a light progression hook. Full spec: `docs/logic/profile-and-identity.md`. |
| D21 | Profile carries **tags** (achievement / skill-rank / special / self-equipped) next to the avatar | accepted | Owner request (2026-09-27). One equipped at a time from the user's earned set. Full spec: `docs/logic/profile-and-identity.md`. |
| D22 | Phone-number linking (OTP) is **fully optional**, account-recovery only, never a gate on any feature | accepted | Owner request (2026-09-27), refines D7. Entry point is a profile-screen button, not onboarding. |
| D23 | Matchmaking is backed by an **undisclosed pool of AI opponents ("bots")** that fill queues when no human is available | accepted | Owner request (2026-09-27): "کاملاً شبیه آدم واقعی جلوه بره" — always available, human-like randomized delay, never revealed as a bot in any UI/API surface. Because this touches real coin stakes, a subsidy mechanism (`bot_match_subsidy` ledger reason) keeps payout math fair to the human player — see `docs/logic/bots.md` §Economy interaction. Chat is canned-taunts-only for MVP (no live LLM in the realtime path). |
| D24 | Price-guess rounds carry a **real coin wager** (2–5 coins/round, escrowed per round, winner takes the pot minus house cut) in competitive modes | accepted | Owner request (2026-09-27) — the "شرط‌بندی" (betting) flavor the owner liked earlier now has real stakes, not just match-score points. Solo has no wager. Full spec: `docs/logic/price-guess-round.md` §Real coin side-bet. |
| D25 | Design the **coin-package IAP schema now** (`coin_packages` table, Cafe Bazaar/Myket billing, `purchase` ledger reason with server-side receipt verification), without building or enabling it at MVP | accepted | Owner request (2026-09-27): "از همین الان براش جا باز کنیم در طراحی." Whether/when to turn purchases on is still open question 4 — this decision is only about not needing a schema retrofit later. Full spec: `docs/logic/economy.md` §Real-money coin purchases. |
| D26 | Bootstrap catalog sourcing: **manual/AI-assisted archive research + personal/family memories**, both allowed until UGC carries the load | accepted | Owner request (2026-09-27). AI research suggestions land as `status: pending`, never auto-approved — human verifies before publish. Full spec: `price-catalog` skill §Bootstrap sourcing. |
| D27 | **Hand-curate 50–100 puzzles first**, generator built afterward to imitate that style; group titles are **AI-drafted, owner-approved** (never auto-published) | accepted | Owner request (2026-09-27): quality/tone bar set by humans before automating. Full spec: `docs/logic/puzzle-generation.md` §Content bootstrap order. |
| D28 | Brand mood = **nostalgia + playfulness combined** (warm aged-paper base + the bright Connections group colors as accents); Vazirmatn for UI, a **separate nostalgic display font for titles/brand** (family TBD); app icon/logo deferred | accepted (direction) / open (specific tokens) | Owner request (2026-09-27). Group colors were already locked in `persian-rtl-ui` skill; this decision is the *mood* and the *two-font system*, not final hex/font-family values — those are explicitly still open. Full spec: `docs/brand-visual.md`. |
| D29 | Final game name: **«دوزاری» (Dozari)**, code identifier `dozari`, deep-link scheme `dozari://`, primary tagline «دوزاریت می‌افته؟» | accepted | Owner choice (2026-09-27), resolves open question 5. Double meaning: the old 2-rial payphone coin (price nostalgia = content) and «دوزاریت افتاد؟» = "did the penny drop?" (the Connections aha moment = mechanic). Repo/internal scaffolding may still reference the earlier `gheymat` codename in places; `dozari` is the product-facing identifier going forward. Store/domain availability still to be checked. Full name, slogans, voice, and approved copy: `docs/brand.md`. |
| D30 | Turn model (D8) reconfirmed as final: **shared board, alternating turns**, not parallel race | accepted | Owner confirmed (2026-09-27), resolves open question 6. No change to `logic/game-rules.md` mechanics — the "Alternatives" section stays for reference only. |
| D31 | Locked-out side that stays to the end and wins price-guess rounds gets a **small consolation bonus score** (never enough to overturn a puzzle-portion loss) | accepted | Owner request (2026-09-27), resolves open question 9. A side that forfeits/abandons gets no bonus. Full spec: `logic/game-rules.md` §Price-guess bonus points & the locked-out side. |
| D32 | Min content for launch confirmed: **≥ 300 products (≥ 3 price points each) + ≥ 200 validated puzzles pre-generated** | accepted | Owner confirmed (2026-09-27) as the launch target, resolves open question 7. Hand-curated 50–100 (D27) is the earlier internal MVP/tone-setting milestone within this larger target, not a separate lower bar. |
| D33 | Add a **player level/XP system** (cosmetic progression, separate from the skill-rank tag) — XP per finished match + win bonus + price-guess points, shown as a level badge + XP bar on the avatar/header | accepted (feature) / proposed (curve & numbers) | Owner request (2026-09-27): "لول‌بندی کاربرا رو نداره" — profile felt flat without visible growth. Never affects matchmaking (D12 stands — no ELO). Full spec: `docs/logic/progression.md`. |
| D34 | **Puzzle difficulty scales with the player's skill tier** (already-existing تازه‌کار/مبتدی/حرفه‌ای tag from `profile-and-identity.md`) — higher tier biases puzzle *selection* toward subtler rules/more red herrings; duel puzzle picks use the higher/average tier of the two matched players so both sides see the same puzzle | accepted (feature) / proposed (weighting mechanics) | Owner request (2026-09-27): "باید سعی کنیم اسکیل بازی رو تعیین کنیم که هرچی مهارت میره بالا سخت‌تر هم بشه." This is content *selection*, not opponent matching — D12 (no ELO-based matchmaking) is unaffected. Full spec: `docs/logic/progression.md`. |
| D35 | **Superseded the D28 pastel-paper palette with a "cool arcade" palette v2** — cool near-white/near-black ink instead of warm paper/coffee-brown, a violet→teal gradient accent (`--accent-grad`) used on primary CTAs, the logo, the level chip and the chat bubble, bigger radii (`--radius-lg/md`) and a real drop shadow (`--shadow`) instead of a flat 1px line | proposed | Owner rejected the pastel-paper execution outright (2026-09-27): "این گرافیک اصلا مناسب اپ نیستا باید خیلی کول تر باشه." Same nostalgia+playful *mood* from D28 (brief unchanged) but the paper/coffee execution is replaced; the locked Connections group colors (yellow/green/blue/purple) and the result-chart `s1–s4` colors are untouched. Implemented in both prototypes. Still needs owner sign-off — see open question 10. |
| D36 | **Self-hosted, hand-authored SVG icon set** (`prototype/screens/icons.svg`, inlined per-page since `file://` blocks cross-file `<use>`) replaces raw emoji for UI chrome (bottom nav, mode cards, admin actions, chat FAB) | accepted (approach) / proposed (exact glyphs) | Owner request (2026-09-27): "آیکون‌ها رو سعی کن یه پک حرفه‌ای رو پروژه نصب کنی." This session's network policy blocked fetching a named external icon package (e.g. via npm/jsdelivr), so a consistent 24×24, 2px-stroke icon set was hand-authored instead — which also avoids a runtime CDN dependency (rule 8) better than pulling one would have. Product emoji on the puzzle tiles (🥤📼 etc.) are content, not UI chrome, and are unchanged. Revisit with a licensed pack (e.g. self-hosted Lucide/Tabler files) once network access allows fetching one, or if the hand-drawn set doesn't hold up at higher fidelity. |
| D37 | **First-ever solo puzzle is an eased tutorial run**: forces the first authored puzzle (`PUZZLES[0]`), allows 2 extra mistakes (`MAX_MISTAKES+2`, solo-only), and shows a dismissable-by-progress banner explaining the mechanic before the player's first submit | accepted | Owner request (2026-09-27): "یکم گنگه... بنظرم مرحله اول آسون‌تر باشه که آشنا بشن." Gate is a `gh_solo_played` localStorage counter — the ramp applies once, to the very first completed solo game, never again. Never touches duel mistake limits or scoring (D8/D30 unaffected). Full spec: `docs/logic/app-screens.md` §Onboarding. |
| D38 | **Admin panel target platform is a full-featured web app**, not a screen bolted onto the Expo mobile client — real auth/roles, live data, and every moderation/ops action actionable from the browser | accepted (direction) / open (stack choice) | Owner request (2026-09-27): "ادمین پنل باید واسه وب هم باشه با امکانات کامل که بشه از اونجا مدیریتش کرد." Narrows part of open question 11/`app-screens.md`'s "`apps/admin` vs. separate tool" question toward *definitely web, definitely full-featured* — still open: plain React/Vite admin app vs. Expo-web reuse, and the auth/roles model. Track as a Phase 7 `PLAN.md` task; `prototype/screens/admin.html` remains the interaction-design mock only, not the implementation target. |
| D39 | **Opponent HUD during a live match** always shows the opponent's avatar, nickname, coin balance, and level — not just score/mistakes | accepted | Owner request (2026-09-27): "وقتی داریم با یکی بازی میکنیم مشخصاتش آواتارش مقدار سکه‌هاش لولش همش بیاد که هیجان کارو زیاد کنه" — makes the opponent feel like a real person with a real stake, raising tension. Full spec: `docs/logic/game-rules.md` §Match HUD. |
| D40 | **Matchmaking search shows a "scanning for an opponent" card** — nicknames/avatars cycle briefly before the match is found, instead of a bare spinner | accepted | Owner request (2026-09-27): "موقع انتخاب حریف یسری کارت بیاد که داره از تو اسم‌های مختلف یکی رو پیدا میکنه که این حس و نده کسی نیست" — a bare spinner reads as an empty app; a visible "searching among players" moment reads as a live population. Full spec: `docs/logic/matchmaking.md` §Search reveal card. |
| D41 | **The opponent that "wins" the search-card cycle in D40 is who gets revealed** — including a bot, per D23's undisclosed-bot policy, with a normal-looking name/avatar drawn from the same pool real players use | accepted | Owner request (2026-09-27): "از تو اون کارت‌ها مثلا ربات با اسم و مشخصات واقعی وارد میشه." Directly extends D23 (bots are never revealed as bots) to this specific UI moment — the reveal card must not visually distinguish a bot result from a human one. No new spec section; folds into D23/`bots.md` and the D40 reveal card. |
| D42 | **A returning player with an unfinished match sees a persistent "game in progress, tap to rejoin" indicator** (icon/badge) as soon as they reopen the app, until they rejoin or the match ends | accepted | Owner request (2026-09-27): "اگه بازی رو باز داشتم و افتادم بیرون، موقع برگشت یه آیکن بگه هست و می‌تونه دوباره بپیونده." This is the client-side surfacing of the reconnect flow `matchmaking.md`/`ARCHITECTURE.md` already assume server-side; the decision here is that it must be *visible and proactive* (a badge on Home/nav), not just "reconnect works if you happen to navigate back into the match." Full spec: `docs/logic/app-screens.md` §Resume-match indicator. |
| D43 | **Mid-match AFK/disconnect → silent bot takeover** after a grace period, same undisclosed-bot policy as D23 | accepted | Owner request (2026-09-27): "وسط بازی اگه کسی لفت داد یا نتش مشکل پیدا کرد، بعد از یه مدت ربات جایگزینش بشه اما معلوم نباشه ربات." Extends D23 from "fills an empty queue slot" to "takes over an abandoned live seat" — same disclosure rule, same subsidy-ledger concern (`bots.md` §Economy interaction) now also covers a mid-match handoff, not just a match start. Grace-period timer is a new config value, not yet picked — track under `bots.md` open questions. |
| D44 | **Players can browse other users and send friend requests** | accepted (feature) / proposed (screen design) | Owner request (2026-09-27): "ما بتونیم بقیه رو هم ببینیم و درخواست دوستی بدیم." New surface area — needs a data model addition (`friendships` table/relation) beyond what `data-model.md` currently covers. Full spec: `docs/logic/profile-and-identity.md` §Friends & player browsing (new). |
| D45 | **Online player count shown somewhere persistent** (e.g. Home header/banner) | accepted | Owner request (2026-09-27): "تعداد کاربرای آنلاین رو یه‌جا نمایش بده." Cheap, high-leverage "this app is alive" signal — pairs with D40/D46. Real number if available, otherwise a smoothed/rounded server-computed figure (never fabricated client-side) — implementation detail for `matchmaking.md` or a new lightweight presence service. |
| D46 | **General mandate: actively counter any "this app feels empty" impression** — D40/D41 (visible search), D42 (resume badge), D44 (browse players), D45 (online count) are the first wave; revisit with more social-proof/activity signals (e.g. a light activity feed, "X people solved today's puzzle") as the game grows | accepted (direction) | Owner request (2026-09-27): "گزینه‌هایی که حساسیت کاربر رو ایجاد میکنه که اپ شلوغیه بیشتر روش کار کن." Umbrella decision — not a new screen by itself, a standing design priority to weigh whenever a screen is designed or revisited. |
| D47 | **Puzzle/board size scales with difficulty**, not just group-content subtlety (D34): easier tiers can offer a smaller board (e.g. 3×3 = 9 items / fewer groups) instead of always the full 4×4/16-item Connections board; harder tiers can go *larger* than 4×4 | accepted (direction) / open (exact sizes & group-count math) | Owner request (2026-09-27): "واسه شروع بازی یسری گزینه‌های آسون‌تر مثلا ۳×۳ باشه، ۴×۴ نباشه، ولی توی لول‌های خیلی سخت تعداد جدولش بیشتر هم بشه." This is a bigger change than D34's original scope (which only varied *which* puzzle/rule-subtlety, keeping the 4×4/16-item/4-group shape fixed per D19's brief) — board geometry itself becomes a difficulty lever. Needs real design work: how a 3×3 board maps to the existing "4 groups of 4, 1 point per group scored by tier" scoring model (`game-rules.md`), and whether `validatePuzzle`/the generator (`puzzle-generation.md`) can produce non-4×4 boards at all. Track as an open question under `progression.md`, not implemented in the prototype yet — too structural to mock without breaking the existing board code. |
| D48 | **Icon-only UI elements get a short caption/hint underneath**, not just a title-attribute tooltip | accepted | Owner request (2026-09-27): "زیر متن‌های اون آیکن‌ها یه راهنمایی کوچیک هم باشه قشنگ میشه." Already the pattern for the bottom nav (خانه/پروفایل/تنظیمات) and mode cards (`<small>` under each); extend the same convention to any new icon-only control (friend-request button, online-count badge, resume-match badge, etc.) going forward — a house style rule for `app-screens.md`, not a one-off fix. |
| D49 | **A dedicated leaderboard/rankings screen** the player can navigate to at any time | accepted | Owner request (2026-09-27): "یه‌جایی باشه بتونه کاربر بره رقابت‌ها هم ببینه." Full spec + prototype: `docs/logic/app-screens.md` §Leaderboard, `prototype/screens/leaderboard.html`. |
| D50 | **A tournament screen**, plus period-scoped rankings (day / week / month / all-time) on the leaderboard from D49 | accepted (feature) / proposed (tournament format & rewards) | Owner request (2026-09-27): "یه صفحه هم باشه تورنومنت برگزار کنیم و جایگاه کاربرارو بر اساس روز هفته ماه و کل بازی نشون بده." Tournament *format* (bracket vs. leaderboard-style event, entry fee, prize pool/coin payout, schedule/cadence) is not decided — flagged as an open question. Full spec: `docs/logic/app-screens.md` §Leaderboard & tournaments. |
| D51 | **Entry fees scale with difficulty** — a harder match (higher skill tier / bigger board per D47) costs more coins to enter, a easier one costs less than the current flat `ENTRY_FEE` | accepted (direction) / open (exact tiered numbers) | Owner request (2026-09-27): "هرچی بازی رو سخت‌ترش میکنه ورودی‌هاش سنگین‌تر باشه." Extends `economy.md`'s flat `ENTRY_FEE` (D9) into a tier-scaled table; exact multipliers need the same playtesting pass as the rest of `economy.md`'s numbers (open question 1). |
| D52 | **Private table hosts get more visible ownership/control features** than the current bare room-code + seat management | accepted (direction) / proposed (exact feature list) | Owner request (2026-09-27): "موقع ایجاد میز یکم امکانات بیشتر بدیم به سازنده که حس مالکیت رو بهش القا کنیم." First pass implemented in the prototype (`table.html`): host badge/crown, a custom table name/emoji, a board-difficulty picker for the table, and a "start requires host confirmation" toggle. Full spec: `docs/logic/app-screens.md` §Private table. |
| D53 | **Ask for the player's province (and optionally city) — optional, not a gate** — to power regional leaderboards and informal "city crews"/rivalries | accepted (feature) / proposed (exact UX: onboarding step vs. profile-only) | Owner request (2026-09-27): "اگه از افراد استانشون رو هم بپرسه بد نیست، بشه یه کل‌کل‌های شهری هم راه انداخت و اکیپ‌های شهری تشکیل بشه." Must stay optional per the entry-must-be-frictionless brief (same spirit as D22's optional phone link) — never required to play. "City crews" (persistent regional teams, not just a leaderboard filter) is a bigger social-feature question, flagged as open rather than designed here. Full spec: `docs/logic/profile-and-identity.md` §Province/city (new), `docs/logic/app-screens.md` §Leaderboard & tournaments (regional filter). |
| D54 | **Prototype rebuilt as a true single-page app with fixed, non-scrolling "game scenes"** and JS-driven scene transitions (no page reloads/links between screens) — replaces the multi-file `screens/*.html` navigation model | accepted | Owner request (2026-09-28): "بنظرم باید spa باشه، کامل میخوام وایب گیم باشه" — explicit rejection of the earlier website-feeling navigation (bottom nav bar, scrolling pages, per-screen `<a href>` links). New file: `prototype/game.html`. Content-heavy screens (profile, leaderboard) use in-scene tabs instead of page scroll to stay on one screen. The multi-file `screens/*.html` set (and `index.html`) is kept as-is for reference/history, not deleted — `game.html` is the new primary prototype going forward pending owner sign-off. |
| D55 | **Visual identity moves to "Candy Arcade" v3** — a deliberately single, non-adaptive game-world look (vivid magenta/violet night-sky gradient, chunky glossy 3D buttons with a thick drop "shelf" edge, sticker-style outlined display type) replacing the D35 "cool arcade" v2 flat palette | accepted (direction) / proposed (exact tokens) | Owner request (2026-09-28), narrowed through a reference discussion: candy-vivid color energy (closest to Candy Crush Saga among the options offered), glossy chunky buttons (Coin Master/Clash Royale), a central hub with big portal buttons instead of a list/nav (also D54). Deliberately **not** light/dark-adaptive — real game main-menus don't reskin with the OS theme (see `artifact-design` principle: "a design that deliberately commits to a single visual world... may stay single-theme"). Locked Connections group colors (yellow/green/blue/purple) and chart `s1–s4` colors are unchanged. Full spec: `docs/brand-visual.md` §Color v3. **v3.1 polish pass (same day):** owner found the first pass "too simple, like a generic game" and asked for real glassmorphism and a much higher production level. Added: true frosted-glass panels/chips/tiles (`backdrop-filter: blur+saturate`, inset highlight), a layered ambient backdrop (blurred drifting color blobs + a twinkling sparkle field + a subtle grain overlay, all pure CSS/no assets), a periodic diagonal shine sweep across every button/portal, a staggered pop-in animation for the hub portals, a glowing spotlight + orbiting sparkles under the mascot, and a shimmering gradient sweep on the logo text. |
| D56 | **Mascot character: «دایی‌دوزاری» (Uncle Dozari)**, an anthropomorphic gold coin with a mustache and a flat cap, appears on the hub screen (idle bob + wave animation, a speech-bubble line) and reacts to level-ups | accepted (character) / proposed (name & exact personality) | Owner request (2026-09-28): wanted a mascot like Coin Master's, left the concept to Claude. Ties directly to the game's own name/economy (the دوزاری = old 2-rial coin) rather than a generic animal mascot, reinforcing the nostalgia layer from D28 inside the new candy-arcade chrome. Hand-drawn inline SVG in `prototype/game.html`, no external image asset. Revisit character design once a real illustrator/brand pass happens. |
| D57 | **Hub portal icons are a hand-drawn "3D clay" SVG set** (trophy/gift/puzzle/user — gradient-shaded, drop-shadowed, no external files), instead of licensed stock icons | accepted (prototype only) | Owner shared a Vecteezy "3D quiz icon" reference and asked to use assets from there, with "اگه لایسنس داشت میگیرم" (will buy a license for the real app if needed) — i.e. explicitly not yet licensed. This session's network policy also blocks vecteezy.com outright. Downloading/embedding unlicensed stock art into the repo isn't something to do without a confirmed license, so a matching hand-drawn style was built instead (`prototype/game.html`, inline `<symbol>` defs `i3d-*`). **For the real app**: once the owner buys an actual icon-pack license, swap in those files as local assets — this hand-drawn set is a stand-in, not the intended final art. |
| D58 | **Display/brand font locked in: Lalezar**, resolving the "nostalgic display font" half of open question 10 | accepted | Owner confirmed (2026-09-28): "همین Lalezar رو قطعی کن" — it's what every prototype screenshot has used for the logo/headlines since early on and never drew a complaint, so no separate candidate review was needed. Vazirmatn stays the body/UI font (unchanged, `persian-rtl-ui` skill). App icon/logo mark itself is still undecided (see open question 10, now narrower). |
| D59 | ~~Mascot personality is playful/mischievous~~ (superseded same day) | superseded | Owner first asked for a playful/mischievous redesign (wink, raised brow, smirk, cheeky idle lines), then reverted it (2026-09-28): "شخصیت رو درست می‌کنیم، ولش کن تو گند می‌زنی" — character design for «دایی‌دوزاری» is the owner's own call, not Claude's to iterate on. Reverted `prototype/game.html`'s mascot face and idle-line cycling back to the original simple friendly design from D56. **Claude does not touch the mascot's face/personality again without an explicit owner request** — only the owner decides this one. |
| D60 | **Tournament format: single-elimination bracket** (16 players, one duel-puzzle match per round, loser is out), not an ongoing leaderboard-style event | accepted (format) / proposed (bracket size, prizes, bye handling) | Owner picked this explicitly (2026-09-28) over the leaderboard-style alternative, resolving D50/open question 16's format fork. Bigger engineering lift than a leaderboard event would have been: needs bracket generation/seeding, per-round match scheduling, and a bye rule for uneven signup counts — none of that is designed yet, only the format choice and a mocked bracket-progress visual (`prototype/game.html` §Leaderboard → Tournament tab). Prize table beyond "۱st place" and exact entry fee are still open. |
| D61 | **`PRICE_GUESS_ROUND_WAGER` pinned at 3 coins**, resolving open question 9 within D24's 2–5 range | accepted | Not a new owner ask — this is just promoting the prototype's long-standing placeholder value (`PRICE_GUESS_ROUND_WAGER=3` in `index.html`/`game.html` since D19/D24 were written) to an actual decision, since nothing in playtesting so far has argued for a different number in the allowed range. Still subject to revision once `packages/shared/scripts/simulate-economy.ts` exists (open question 6). |
| D62 | **`BOT_TAKEOVER_GRACE_SECONDS` proposed at 15s** — how long a mid-match disconnect/AFK seat waits before D43's silent bot takeover kicks in | proposed | Claude default (2026-09-28) to unblock the open item — intentionally shorter than `RECONNECT_GRACE_SECONDS` (60s, `matchmaking.md`) because a *live* match has other real players actively waiting on that seat, unlike an abandoned queue slot; picked to feel responsive without punishing a normal brief app-switch. Needs the same real-queue-data tuning pass as `BOT_FALLBACK_SECONDS` (open question 7) once telemetry exists. |
| D63 | **Database: MySQL 8 (utf8mb4) for now, Postgres later if needed** ("D63" in code comments) — supersedes the Postgres part of D3. **No JSON and no array columns: every multi-valued field is its own table.** | proposed (owner request 2026-09-29: more familiar, easier to administer) | Costs already paid: ids are app-generated UUID v7 `CHAR(36)`; times are `DATETIME(3)` UTC; "unique among approved" uses a stored generated `approved_flag` (no partial indexes); upserts use `ON DUPLICATE KEY` and a follow-up SELECT (no `RETURNING`); `audience`/`era_tags` became `product_audiences`/`product_era_tags`. Later-phase specs that say `jsonb` (puzzle group `rule`, match events `payload`, UGC `payload`) must be normalised into tables when built. Watch-outs: features planned around Postgres (row locks with `SKIP LOCKED` are available in MySQL 8; partial indexes and `RETURNING` are not). Postgres migration files were dropped and regenerated (nothing had been deployed). |
| D64 | **Daily reward: a growing streak, one claim per 24 h, amounts set in the admin panel** — supersedes the flat "Daily login 30 / Tehran calendar day" row of `economy.md` | proposed (owner request 2026-10-01) | Day 1 = 10, day 2 = 15, day 3 = 20 coins (editable day by day in the admin panel; after the last configured day the last amount repeats). One claim per 24 h *rolling* from the previous claim (owner's wording), not per Tehran calendar day. A claim 24-48 h after the last one continues the streak; waiting 48 h or more (a whole day skipped) starts again at day 1. Constants in `config/economy.ts`; calculator `nextDailyReward` in shared; amounts stored in `daily_reward_steps`, per-player state in `user_daily_rewards`, coins through `coin_ledger` (key `daily_login:<claimNo>:<userId>`). Open: a rolling window means the exact claim time drifts; if players find that annoying, switch to Tehran calendar days (only `nextDailyReward` changes). |
| D65 | **Avatars and nicknames: one free pick after N games, everything else costs coins and needs an activated profile + level** (does NOT replace the finished-games unlock) | proposed (owner requests 2026-10-01) | After 3 finished games the player picks one avatar from the free set; after 10, one nickname from the free set (counts editable in the admin panel later). All other avatars/nicknames are bought with coins; buying or switching to them needs an activated profile (invite code redeemed, `chat_unlocked_at`, checked first) and level ≥ `AVATAR_CHANGE_MIN_LEVEL` (3) / `NICKNAME_CHANGE_MIN_LEVEL` (5) — placeholder numbers. Pure rule `canCustomise` in shared. Open: which items are free, coin prices, whether other cosmetics (tags, frames) share these levels. |
| D66 | **The hero character wears the look of the current Solar Hijri month**, automatic from today's date in Tehran — using the designer's own 12 month looks | proposed (owner request 2026-10-01) | Supersedes the first version I drew myself: the designer's `Character.dc.html` already has `month=1..12` for «دوزاری» (sabzeh, flower hat, cherry earrings, sunglasses, watermelon slice, pencil, school backpack, rain and leaf, falling leaves, Yalda pomegranate, earmuffs and snow, goldfish bowl). Pure helpers in `shared/calendar/solar-month.ts`; the character is `components/Character.tsx` (+ `theme/character*.ts`). Home, splash and the solo result show the current month. Open: event days (Nowruz, Yalda) as extra looks; whether players may pin a month. |
| D67 | **Every player name is tappable and opens a profile summary with a friend/connection request** | proposed (owner request 2026-10-01) | Anywhere a nickname is shown (match, results, leaderboard, friends, chat): tap opens a sheet with avatar, nickname, member-since, cups (tournament trophies), coins, level, medals/tags, tier and win stats, plus «درخواست دوستی». Needs a public-profile endpoint (never exposing `is_bot`; bots look like players) and the `friendships` table of D44. Coins shown only if the owner agrees it is public (open). **Built (v1)**: `GET /players/:id` (nickname, avatar, level 1, coins, member since, relation), friend requests `POST /friends/:id/request|accept`, `DELETE /friends/:id`, `GET /friends`, migration 0009 `friendships`; app: `PlayerSheet` + «پروفایل من» with friends/requests; a Bale message tells the target about a new request. Cups, medals, tier and win stats are not shown because those systems do not exist yet; coins are shown (owner to confirm). No screen shows other players' names yet except the friends list, so the tap-everywhere part waits for the duel/result/leaderboard screens. |
| D68 | **Optional gender setting (female / male) next to province/city; it switches the hero character (and the app icon) to that gender** | proposed (owner request 2026-10-01) | Stored on the profile like province/city (`users.gender`, nullable, enum, no free text); never shown publicly unless the owner decides so. Everywhere the hero «دوزاری» is drawn (home, splash, results, month looks) uses the matching variant; the app icon follows via alternate launcher icons (Android activity-alias / iOS alternate icons: possible, but a change needs the app to relaunch or the launcher to refresh). The designer has delivered the female hero (`dozariF`: braids with ribbons, lashes, skirt, same 12 poses), ported as `who="dozariF"`; the setting itself (profile field, picker, icon switch) is not built. Open: default when unset (current male hero?), whether the other six characters stay as they are, and whether a player may change it later. **Built (v1)**: `users.gender` (nullable enum, migration 0009), `PUT /me/gender`, `GET /me/profile`, a picker in «پروفایل من» (خانم / آقا / نمی‌گویم); Home draws `dozariF` for «female», the original hero otherwise (default male while unset); the player may change it any time. Not built: other screens (splash, results) using the gender, and the app icon switch (needs native alternate-icon support, not available in Expo managed without a plugin; to be decided). |
| D69 | **Profanity filter on every free-text input** (chat, and any other place players type text) | proposed (owner idea 2026-10-01) | Server-side check before a message is accepted or shown, so a modified client cannot bypass it. Word list is editable from the admin panel (add/remove words, per-word severity: block or mask), with Persian normalisation (digits, ZWNJ, Arabic/Persian letter variants, spaced-out letters, repeated letters) so «ک‌ص» style evasions are caught. Complements D35's rule that free chat needs a redeemed invite code. **Built (filter, list, admin section «فیلتر کلمات»); not yet called by any player-facing input because chat does not exist yet** — `TextFilterService.check` is the one gate to call. The list starts empty: the owner adds the words. |
| D70 | **Price lookup («استعلام قیمت»)**: any player can look up the historical price of a catalog product in a given year | proposed (owner idea 2026-10-01) | Family-gathering use case: «بنزین سال ۶۰ چند بود؟». Search a product, pick a year (or see the whole chart); answers only from approved price points, shows the source and confidence, and says plainly when there is no approved data (never an estimate). Reuses the result chart and the catalog API; also a retention hook (people open the app outside games). Open: free or limited per day, whether to show it before login, and a «ask for this item» button feeding the bot / suggestion queue. **Built (minimal)**: `GET /lookup/search?q=` + `GET /lookup/:id?year=` (public, approved data only) and a Home button «استعلام قیمت» → search, year chips, answer or «no data». Free, no login, no limits yet; «ask for this item» not built. **D119 (owner note 6, 2026-10-02)**: a row of category chips (`PRODUCT_CATEGORIES`) above the search box; `GET /lookup/search?category=` works alone (browse, up to 40 items) or narrows a text query; at least one of `q`/`category` is required. |
| D71 | **Every product carries a price range**: several approved price points per product, each with Solar Hijri year (+ optional month) and nominal rials | proposed (owner 2026-10-01) | The range = earliest/latest date and cheapest/dearest price among *approved* points (`priceRange` in shared); a single date's price = exact month, else the year's median, never interpolated (`priceOnDate`). A product with fewer than `MIN_PRICE_POINTS_PER_PRODUCT` = 3 approved points is flagged «قیمت بیشتر لازم است» in the admin catalog (filter + card badge) and is the natural target for the content bot. Used by the price lookup (D70) and charts. The minimum is a proposed number; whether products below it may still appear in puzzles is open. |
| D72 | **Bale bot for notifications**: players link their Bale chat with a one-time code; the game sends them results, daily-reward reminders and admin broadcasts there | decided (owner request 2026-10-01) | Spec `docs/logic/bale-bot.md`. Telegram-compatible API, long polling, outbox table with retries, admin section «ربات بله». The owner must create the bot on Bale and put `BALE_BOT_TOKEN` / `BALE_BOT_USERNAME` in the server env. Not tried against real Bale servers. Open: which further events should notify (friend requests, tournaments), quiet hours, a per-player on/off per kind. |
| D73 | **Admin message center**: send/manage messages from the panel over several channels (in-app inbox, Bale, SMS, e-mail, push) | decided (owner request 2026-10-01), partly built | Spec `docs/logic/message-center.md`. In-app inbox and Bale work; SMS, e-mail and push are listed but disabled with a reason because there are no recipients (phone/e-mail) or providers yet, and FCM is not allowed. Open: SMS provider, whether to collect e-mail, a non-Google push route, scheduled sends. |
| D74 | **Professional admin: user management and app management** | decided (owner request 2026-10-01) | Spec `docs/logic/admin-panel.md`. Users: filters/sort/paging, detail with ban reason, log-out-everywhere (`sessions_valid_after`), identity reset, notes. App: maintenance mode, minimum build / forced update, per-feature switches, all from the settings registry (now with a `text` kind). Not built: several admin accounts with roles (needs login accounts instead of one token), data export, a player-report queue. |
| D75 | **Store review prompts for Myket / Bazaar / Bale, controlled from the admin panel** | decided (owner request 2026-10-01) | Spec `docs/logic/store-review.md`. Per-store switches, first ask after N days and N games, repeat pause, cap, links (Myket/Bazaar built from the package id, Bale link supplied by the owner). Build flavor `EXPO_PUBLIC_STORE` tells the app its market. Open: the exact Bale app-page URL; whether to use the stores' in-app rating deep links. |
| D76 | **Separate admin accounts with roles (owner / editor / support / viewer)** replace the single shared token | decided (proposed after the security audit, built 2026-10-01) | Spec `docs/logic/admin-panel.md` §Admin accounts. scrypt password hashes, 8-hour sessions, lockouts, per-admin audit names, deny-by-default permission map. `ADMIN_TOKEN` stays as an optional break-glass owner. Not built: 2-factor sign-in, password reset by e-mail, IP allow-list, per-admin session list. |
| D116 | **Lucky wheel (گردونه) is a post-win reward only** (built) — one spin per *won* match (never on loss/draw/abandon, never on app open or daily login). Prizes are coins via `coin_ledger` (`wheel_spin`), server-rolled with an injected seeded RNG; amounts/odds live in `config/economy.ts` | proposed (built; prize table is a placeholder) | Owner request (2026-10-02): «گردونه فقط شانس بعد از برد باشد». Supersedes the open wheel choice of D111/D114; the unused daily wheel page was removed. Details: `docs/logic/economy.md` §Lucky wheel. |
| D117 | **Level road pays coins every 5th level and shows higher shop tiers** | proposed | Owner (2026-10-02): «سکه ثابت هر ۵ لول و فروشگاه». Spec: `docs/logic/progression.md` §Level rewards. Also in this change: road header with XP bar, «الان اینجایی» marker, claim-all button; the painted scenes animate (clouds, lanterns, palm — `components/sceneMotion.tsx`, off with reduce-motion). |
| D118 | **Coin history sheet from the coin pill** | proposed | Owner note 13 (2026-10-02). `GET /me/ledger` + `LedgerSheet`; supersedes the 2026-09-27 "no full-ledger view" line in `logic/app-screens.md` §Coin history. |
| D120 | **Guide character + «why is it locked» explanations** | proposed | Owner notes 4 and 11 (2026-10-02). Home's hero is tappable and cycles menu tips in a `GuideBubble`; in the Bazaar a locked item is tappable and the guide says why (level / daily limit / not enough coins) instead of the card being dead. Texts in `fa.ts` (`home.guide`, `shop.why`). |
| D121 | **Background music (synthesised, WebAudio)** | proposed | Owner note 7 (2026-10-02). `sound/music.ts` + `musicPattern.ts`: a quiet looping Shur-like pattern (calm, 76 bpm) on every screen except splash/tutorial, and a faster, livelier one (tense, 128 bpm) in duels. No audio files shipped; web only like the effects (native silent). New personal switch «موسیقی» (`prefs.music`) beside «صدا»; music also stops when «صدا» is off. Browsers start audio only after a first tap, so the loop begins then. Tournaments have no separate screen mood yet. **Revised 2026-10-03** (owner: «زیاد جالب نیست؛ آرام اما بازاری/قدیمی و طبیعی‌تر»): the beeper sine/triangle voices are replaced by plucked-string synthesis (setar/santur-like harmonics), a slow drone, a soft synthesised daf and a short echo; calm is a 16-bar lilting 6/8 in Shur with the half-flat (koron) second; duels keep the faster 4/4. Still no audio files. |
| D122 | **Avatars are the cast; nothing scrolls; the Bazaar pages its items** | proposed | Owner notes 17–18 (2026-10-02). `Avatar` renders `Character` (`skin` = who) face crops (design 09) instead of the coin mascot; pages are hosted by characters (`GuideBubble`). No page scrolls on its own: Hub scales to fit, Settings and Duel mode select tighten on short screens, and the Bazaar splits its items into pages sized from the measured height (prev/next pager). Lists of real data (inbox, chat, ledger, leaderboard) scroll inside their list. Verified with headless Chromium against a real server at 390×780, 360×640, 360×560. |
| D123 | **Week / month leaderboards from an XP event log** | proposed | Owner backlog «week/month leaderboards». New table `xp_events` (migration 0034); windows are rolling 7 / 30 days, not calendar weeks (simpler, no timezone edge). Bots have no events, so they only show in all-time. Public player number / default handle: covered by the existing `users.handle` (D80–D82); a `dozari_xxxx` look would break existing invite links, so left as is. |
| D124 | **Moving scenes drop the pencil-wobble filter; Hub palms and cloud move; city prompts are buttons** | proposed | Owner reports (2026-10-02): clouds, bazaar lanterns and palm did not move; «شهرتو انتخاب کن» appeared with nothing to tap. Measured: the `feTurbulence` filter over a whole animated scene is recomputed every frame (60 → 25 fps in headless Chromium; much worse on phones), so `Scene` now draws a *moving* scene without the filter (still on when «حرکت کمتر» freezes it). `CityHub` gets a drifting cloud and swaying palms (`sceneMotion`). In the leaderboard «شهر من» tab and the city chat, when no city is set, a «انتخاب شهر» button opens `CityPicker` in place and reloads. |
| D125 | **Confirmations for important actions; deleting an account needs a fresh one-time code** | proposed | Owner (2026-10-02): «حتما حتما کد یکبار مصرف». `POST /me/delete/code` sends a 5-digit code (hashed in `account_delete_codes`, migration 0035; 10 min, 60 s between sends, 5 tries) by SMS to the verified phone, else by Bale to the linked chat; `DELETE /me` now needs `{code}`. A player with neither a verified phone nor Bale gets `no_channel` and cannot delete until they verify one (no silent one-tap deletion). App: `ConfirmDialog` / `useConfirm` before sign-out-everywhere, delete (warning → code → delete), unfriend, Bale unlink, leaving a tournament / table, and leaving a running solo or daily game. |
| D126 | **A proven phone number held by another account becomes the player's choice** | proposed | Owner (2026-10-02): if a number is already registered, the app must ask whether to keep this account's progress on it or load the previous one. See `logic/bale-bot.md` §Existing account. Table `phone_conflicts` (migration 0036); typing such a number no longer answers `taken`. |
| D127 | **Duel socket starts with long-polling and upgrades to a websocket** | proposed | Owner: duel kept saying «ارتباط با سرور». Locally it connects, so the likely cause is a proxy/CDN refusing the websocket upgrade (the client allowed `websocket` only). `transports: ['polling','websocket']`: a blocked upgrade now costs speed, not the duel. Still enable websockets on the host proxy for `api.mrbots.ir` (docs/deploy.md). |
| D128 | **«بازی‌های اخیر» on the profile** | proposed | Older ask from the design (profile screen). Reuses `xp_events` (+ `mode`, `outcome`, migration 0037); no opponent name yet. Empty states now use the cast (`EmptyNote`, design 10). |
| D129 | **Coin packages are sold through the Bale wallet** | proposed | Owner pasted Bale's payment docs (`logic/bale-payments.md`). `POST /coin-packages/:id/bale-invoice` → `sendInvoice` into the linked chat; `pre_checkout_query` answered yes only for the right payer / package / level / exact rial amount; coins credited only on `successful_payment`, once per `telegram_payment_charge_id` (store `bale`, migration 0038). Needs `BALE_PROVIDER_TOKEN` (from @botfather) and `feature.coin_packages` on. Not run against the live service. |
| D130 | **Admin puzzle builder (hand-made puzzles)** | proposed | Owner: «پازل نیست». A puzzle needs 4 groups × 4 distinct products; the generator is still unbuilt, so the admin page «ساخت پازل» makes curated puzzles live at once. See `logic/puzzle-generation.md` §Hand-built puzzles. |
| D131 | **Puzzle generator + draft review in the admin panel** | proposed | PLAN Phase 2 `generatePuzzle`; admin «ساخت خودکار» makes `draft` puzzles that a human titles and approves. See `logic/puzzle-generation.md` §Generator + admin panel. |

Owner-approved (2026-09-26). Do these ~3–5 days of experiments first; their results can still
flip D13–D17 before real code is built on top of them. Tracked as checkboxes in `docs/PLAN.md`
Phase 0-A. Each experiment gets a short write-up appended to this section (date, result, verdict).

1. Expo app with RTL + bundled Vazirmatn, **local** Android build (no EAS cloud), installed on
   ≥2 real devices; same code exported to web/PWA and opened in mobile Safari (iPhone). Confirms D2, D13.
2. Minimal Socket.io server on ArvanCloud, hit from Irancell/Hamrah-e-Avval mobile data; measure
   latency and reconnect behavior. Spend ≤1 day comparing against a Colyseus equivalent (D17).
3. Self-hosted `expo-updates` OTA server: push a change, confirm it reaches an installed build
   without a store re-submission. Confirms D14.
4. Try `npm install` / `docker pull` from an Iranian network path (or via the project's CI); note
   which registries/mirrors need to be pinned in `.npmrc` / `Dockerfile` for reproducible installs.

If experiment 1 fails badly (Expo web output is unusable), fall back to a plain React (Vite) web
app wrapped with Capacitor for the Android build — record that pivot here as a superseding decision.

## Open questions (from the brief + new)

Resolved: ~~final game name~~ (D29), ~~turn model confirmation~~ (D30), ~~price-guess tie-break
precedence~~ (D31), ~~min content for launch~~ (D32), ~~display font~~ (D58), ~~mascot
personality~~ (D59), ~~tournament format~~ (D60), ~~price-guess wager amount~~ (D61) — see
Decisions table above.

1. **Exact scoring / coin formula** — defaults proposed (D9). Needs playtesting.
2. **Sources for historical prices** — deferred. Schema already has `source_type`, `source_url`, `source_note`, `confidence`.
3. **Team chat vs cross-team chat visibility** — proposed in `logic/chat-and-access.md`.
4. **Long-term monetization** (ads / subscription / coin packs) — the *schema and integration plan* for
   coin packs is now decided (D25, `economy.md` §Real-money coin purchases); *whether/when* to actually
   enable real-money purchases, ads, or a subscription is still open. Iranian IAP = Cafe Bazaar / Myket
   billing SDKs; Iranian ad networks (Tapsell, Adivery). Don't build/enable until decided.
5. **Moderation capacity for UGC & free chat** — who reviews? Proposed: admin panel + community votes threshold.
6. **Bot economy subsidy mechanism** (D23) — `bot_match_subsidy` ledger reason and its exact
   accounting are proposed, not yet balanced/simulated. Run through
   `packages/shared/scripts/simulate-economy.ts` once bots are built (Phase 4/6).
7. **Bot pool sizing & fallback timing** (`BOT_POOL_SIZE`, `BOT_FALLBACK_SECONDS`) — defaults
   proposed in `docs/logic/bots.md`, to be tuned with real queue-wait data after launch.
8. **Full app-screen inventory** — an in-progress owner interview (2026-09-27) is going
   screen-by-screen through onboarding, home/lobby, private tables, queue, match, chat, result,
   profile, invite, and UGC. Decisions land here and in `docs/logic/` as each screen closes;
   not all screens are covered yet (see `docs/PLAN.md` for what's locked vs. still open).
9. ~~Exact `PRICE_GUESS_ROUND_WAGER`~~ — pinned at 3 coins (D61); full economy simulation still
   needed once bots/wagers are implemented.
10. **App icon/logo mark** — still deferred in `docs/brand-visual.md` (the display *font* is now
    locked, D58). The color palette has moved twice: v2 "cool arcade" (D35) then v3 "Candy Arcade"
    (D55, 2026-09-28) — v3 is the current *proposed* default, needs an explicit owner sign-off
    to flip to `accepted`.
11. **Admin panel** — a first static mock exists (`prototype/screens/admin.html`: puzzle
    approval, UGC moderation, economy overview, content-target progress); the owner has since
    confirmed the *target platform* is a full-featured web app (D38). Auth/roles, real data
    wiring, and the exact web stack are still open — track as a Phase 7 task in `PLAN.md`.
12. **Player-level XP curve and puzzle-difficulty weighting mechanics** (D33/D34) — a working
    default is implemented in the prototypes; needs playtesting/tuning like the rest of
    `economy.md`'s numbers. See `docs/logic/progression.md`.
13. **Icon pack** (D36) — a hand-authored self-hosted set is in place because this session
    couldn't reach an external package registry; swap for a licensed pack (self-hosted files,
    never a runtime CDN) if/when network access allows, or on owner request.
14. **Mid-match bot takeover grace period** (D43) — how long to wait after a disconnect/AFK
    before silently swapping in a bot; no default timer picked yet, track alongside the
    `BOT_FALLBACK_SECONDS` numbers in `docs/logic/bots.md` (open question 7).
15. **Tournament mechanics** (built, see D85) — format is decided (single-elimination bracket, D60); bracket size
    beyond the mocked 16, bye handling for odd signup counts, exact entry fee, and the full prize
    table are still open. `prototype/game.html`'s tournament tab mocks the bracket-progress visual
    and entry point only, not real bracket generation/scheduling.
16. **SPA scope** (D54) — `prototype/game.html` covers hub, play menu, solo/duel board + price-guess
    + result, queue, private table, leaderboard/players/tournament, profile, shop, and settings.
    It does **not** yet include admin, the in-match chat as its own full screen (only the overlay
    drawer during a live duel), UGC submission/voting, or the onboarding slides — those still only
    exist in the older `screens/*.html` set. Folding them into the SPA (and deciding whether
    admin belongs in a player-facing game shell at all, given D38) is unstarted follow-up work.
17. **Board-size difficulty scaling** (D47) — see the new proposed default in
    `docs/logic/progression.md` §Board size as a difficulty lever; still needs owner sign-off and
    real puzzle-content authoring for the 3-item and 5-item group variants before it can move past
    "proposed."
18. **City crews** (D53) — explicitly deferred past launch; not designed further, revisit only if
    players ask for it post-launch.

## D77 — Owner backlog of 27 items is ordered A→F (2026-10-01)

The list is built in the order of `docs/logic/owner-backlog-2026-10.md` because later phases need earlier data (level, badges,
city, friends). Defaults in that file are proposed and tunable from the admin panel; owner confirms or changes them later.

## D78 — Coin shop and paid solo hints (2026-10-01)

Hints in solo games (title / one card / pair) cost coins or a hint token; the shop sells tokens for coins. All numbers, level
gates and daily limits are admin-editable; coins stay scarce by design. Details: `docs/logic/shop.md`. Proposed defaults, owner may change.

## D79 — Invite code is "gold" (2026-10-01)

A personal code is issued from level 3, has 10 uses, is guessed at a limited rate, and redeeming it is what activates free chat,
renaming and (later) gifts/loans. The inviter is paid 100 coins only after the invitee finished 3 games; the invitee gets 50 coins at
redemption. Admin can make special campaign codes (no inviter reward). All numbers are settings; proposed, owner may change.

## D80 — Gifts and loans between friends (2026-10-01)

Friends can gift or lend coins under admin-set rules (friendship age, level, activation, per-transfer range, weekly cap, loan
term, one open loan). Details and defaults in `docs/logic/economy.md` §Gifts and loans. Proposed; the owner may change any number.

## D81 — Phone number first, verified through Bale contact or SMS (2026-10-01)

Bale linking requires a typed mobile number; the bot verifies it from the sender's own shared contact; SMS is the fallback through a
pluggable provider (owner still to choose one). A verified number is unique per account and private. See `docs/logic/bale-bot.md`.

## D82 — Finding friends by ID, phone, contacts and invite link (2026-10-01)

Exact-match search by public ID or verified phone (findable by default, switchable), address-book lookup API, invite link through an
admin-configured shortener, instant friendship for a brand-new account that opens a link. See `docs/logic/find-friends.md`.

## D83 — Badges, medals, notices, skill tier and «آجان دوزاری» (2026-10-02)

Badge catalog with perks and automatic rules, medals, private warnings/commendations, a computed skill tier, short agent mutes with a daily cap,
and a contact-info detector for chat. Details and defaults in `docs/logic/badges-and-moderation.md`. Proposed; the owner may change any number.

## D84 — City chat and admin-managed canned taunts (2026-10-02)

City-mates chat, canned taunts grouped in admin-edited categories, duel taunts, reports. Server-side rules: activation for free text, mutes, the
contact-info perk, profanity filter, rate limits, 30-day retention. See `docs/logic/chat-and-access.md` §As built. Proposed; the owner may change numbers.

## D85 — Tournaments: builder, coin + level entry, single-elimination engine (2026-10-02)

Admin builds tournaments (size, entry coins, minimum level, start, prizes); players join with coins and level; the server seeds by level, runs the bracket through live
duels, pays prizes. House funds prizes, entry fees are a sink. Details and what is not built: `docs/logic/tournaments.md`. Proposed defaults; the owner may change any number.

## D86 — Bot players from the admin panel (2026-10-02)

Admin-generated bot accounts that look like players, fill the queue after a human-like wait, play through the normal submit with a skill-controlled use of the
answer (server-internal only), answer taunts and city chat, and can fill tournament seats. Never disclosed. Details: `docs/logic/bots.md` §As built.
Owner note: undisclosed AI opponents were already approved (D19); the skill cap (90 %) and the rule that bots never take prize coins keep it from being a thumb on the scale.

## D87 — Daily puzzle by day conditions (2026-10-02)

One frozen puzzle per Tehran day, picked from admin-defined themes (occasion/season/trend/category with yearly Solar Hijri or absolute windows), pinned by an
admin or chosen by a date-seeded weighted picker avoiding recent repeats. One attempt a day; small ledger reward growing with the streak. Details:
`docs/logic/daily-puzzle.md`. Proposed defaults (20 coins, +5/day to 7 days, 30-day no-repeat); the owner may change them in settings.

## D88 — City dialect phrases as city-scoped taunt categories (2026-10-02)

Dialect/local phrases reuse canned taunts: a category can be limited to one city, offered and accepted only for that city's players. No new content is shipped; the owner fills it in the admin panel. See `docs/logic/chat-and-access.md` §City dialect phrases.

## D89 — Personal settings and synthesized sound effects (2026-10-02)

Per-device preferences (sound, vibration, reduced motion) in the profile sheet, stored locally (`deviceStore`), never sent to the server. Sound effects (tap, correct,
one away, wrong, win, lose, coin) are synthesized with WebAudio, so no audio files are shipped and nothing depends on Google. Native (iOS/Android) has no sound
engine yet and stays silent; vibration uses `navigator.vibrate` where it exists. Real recorded sounds or a native audio library are the follow-up (owner supplies assets or approves a dependency).

## D90 — Coin-economy audit and balance simulator (2026-10-02)

`simulateEconomy` (shared, pure, seeded) models the duel economy with the launch defaults; match economy numbers now live in `config/economy.ts`. Result: 0.002 % stuck player-days,
but the balance inflates (median 1336 after 30 days; faucets ≈ 1433 vs burn ≈ 100 per player). Proposed: keep numbers until real data, rely on shop/cosmetics/coin packages as sinks,
lower the free-match payout first if needed. Owner may change the numbers; see `docs/logic/economy.md` §Balancing.

## D91 — Coin packages built but off (2026-10-02)

Catalog, level gate, admin CRUD and an idempotent `purchase` credit exist, behind `feature.coin_packages` (default off) and a verifier that refuses until a real store adapter exists.
Still needed from the owner before enabling: Bazaar/Myket developer accounts and SKUs, store receipt-API keys, refund/dispute handling and store-policy review (open question 4).

## D92 — Tournament concurrency switch and daily game caps (2026-10-02)

Owner: tournaments need an admin option for whether a player may be in several at once (default: one at a time), the daily game limit must be settable from the panel, and every game mode and hub should be broadly configurable from the admin panel. Built: per-tournament `allowConcurrent` (default off) and `limit.solo_per_day` / `limit.duel_per_day` (default 0 = unlimited). Standing rule from now on: any new limit, timer or amount ships as a registry setting, and existing hard-coded ones are moved into the registry as they are found.

## D93 — Private tables v1 and sharing them in city chat (2026-10-02)

Friendly 1v1 tables with a code, name/emoji, ready toggle, lock/kick/extend and rematch; shareable into the city chat as a join card (owner backlog item 17). Fees, difficulty, 2v2 and deep links wait for the duel economy and the duel client. Details: `docs/logic/matchmaking.md` §Built so far.

## D94 — Live duel screen in the app (2026-10-02)

The app can now play the existing 1v1 socket flow: queue, board, turn clock, result. It adds `socket.io-client` to the mobile app (no Google dependency). `match:resume` accepts no match id so a table-started match can be picked up. Coin stakes, price round, taunts and reconnect banner remain follow-ups.

## D95 — Coin stakes for live queue duels (2026-10-02)

Entry fee, free daily matches, winner payout, draw refund, loss consolation and the once-a-day broke rescue now run on the ledger for queue duels, all numbers as admin settings (`duel.*`). Tables and tournaments stay friendly. Defaults are the confirmed ones from D9; the simulator (D90) says the economy inflates, so the free-match payout is the first knob to lower if real data agrees.

## D96 — Onboarding tutorial and account controls (2026-10-02)

Four skippable slides before the first Home (seen flag kept on the device); in the profile sheet: replay tutorial, sign out everywhere (`POST /me/sign-out-everywhere`), delete account (`DELETE /me`, two taps) and an about text. Deleting does not erase rows: personal data (device id, phone, email, handle, nickname) is removed and the account becomes an empty banned shell so the ledger and match history stay consistent; the device then starts a fresh guest. Support contact text is generic until the owner gives a real channel.

## D97 — irnoti as the primary SMS provider; self-hosted admin font (2026-10-02)

Phone-verification SMS now goes through irnoti (`POST https://irnoti.com/api/v1/sms/send`, Bearer key, JSON `{to, message}`) when `IRNOTI_API_KEY` is set; the message text is `IRNOTI_MESSAGE` (must contain `{code}`) with a default. Kavenegar stays as a fallback adapter when only its keys are set. The irnoti response body is undocumented to us: any 2xx counts as sent unless the body says `success:false`/`ok:false`/`status:'error'` — verify with a real key. The admin panel now serves Vazirmatn (Regular/Bold) from `apps/server/assets/fonts` at `/admin/fonts/*` (CSP `font-src 'self'`), so it no longer depends on a locally installed font.

## D98 — Installable web app (PWA) (2026-10-02)

The Expo web build is an installable PWA: `apps/mobile/public/` holds the HTML template (manifest link, theme colour, iOS meta), `manifest.webmanifest` (standalone, portrait, fa), icons generated from `assets/icon.png`, and `sw.js`. The service worker caches only the app shell and hashed bundles (cache-first for immutable `/_expo/static/*`, network-first otherwise) and never touches API calls — the game stays online and server-authoritative. No Google/Firebase pieces (no Workbox CDN, no FCM). Browsers allow installing only over https (or localhost), so a phone on the LAN over plain http can play in the browser but not install; the production web build (`pnpm --filter @dozari/mobile build:web` → `dist/`) needs an https host.

## D99 — App screens follow the owner's screen designs (2026-10-02)

The owner's full screen designs (`docs/design/Dozari - 01/11/13/17/19 *.dc.html`, reference images in `docs/design/uploads/`) are the source of truth for layout; the earlier text-only screen specs give way where they differ. Screens are rebuilt one at a time, Home first (screen-home: counters, corner tiles, hero, two big buttons — see `app-screens.md`). Rows are laid out right-to-left on every platform: native flips `row` under forced RTL, react-native-web does not, so web uses `row-reverse`.

## D100 — Live duel screens from the match design (2026-10-02)

The duel now runs through the four views of `Dozari - 13 Match Screens` (mode, versus, match, results; see `app-screens.md`). Departures from the mock-up, because the game rules differ: the match is turn-based on one shared board (not a race on two boards), so the clock plate shows the turn timer and a turn chip says whose turn it is; the magnifier / freeze power-ups are not in the rules and are left out; the 2v2 card is shown disabled («به‌زودی») until team play exists; the reward tiles of the results card are left out because the client is not told the coins paid (the ledger is). The rival is drawn as a market character chosen stably from their avatar key. The versus card holds for 3 s after a match is found (the turn clock keeps running; 45 s per turn by default).

## D101 — Province identity and abroad cities (2026-10-02)

Owner: «وقتی شهرشونو میزنن یکم احساس هم رابطه خودمونی پیدا کنه ... ایرانیان خارج از کشور هم پوشش بده». The player still picks a **city** (D53, optional); each city points at a **province identity** from `Dozari - 18 Provinces` — shared `PROVINCES` (31 provinces of Iran, seven abroad cities: Istanbul, Dubai, Toronto, Los Angeles, London, Paris, Berlin, plus a generic `abroad` entry): badge landmark, colours, souvenir, local greeting, rival. `cities.province` (nullable, admin-editable) holds the key; the Iran-wide «شهر دیگر» has none, «کشور دیگر» is `abroad`. Default cities missing from an existing table are added at startup. The app shows the badge grid as the city page, the badge and greeting («سلام اصفهانی!») on Home, and the badge next to the city on profiles. Souvenirs whose icon is not in the item pack use the nearest one (or the gift box) until the icons are drawn. **Proposed, not built:** the design's daily souvenir task («۳ دست ببر»), the province leaderboard and the Friday «جنگ استان‌ها» — they need economy and leaderboard rules first. Global chat beside the city chat comes in its own change.

## D102 — Complete PWA (2026-10-02)

Owner: «کارای فنی PWA هم بکن کامل». On top of D98: (1) `scripts/pwa-build.mjs` runs after `expo export` and stamps `dist/sw.js` with a build hash and the full precache list (bundle, the three used font files, icons), so the installed app opens offline after one visit and every release gets a fresh cache; (2) a new version **waits** and Home shows «نسخهٔ تازه» with an update button (message `skip-waiting`, reload on takeover) — never reloaded under a running match; the page also checks for releases every 30 min; (3) our own install card on Home (snoozed 7 days on «بعداً») and a profile button, using Chrome's `beforeinstallprompt` (captured in `index.html` before the app loads) or, on iPhone, a sheet with the Safari steps; (4) an offline strip on every screen; (5) manifest `id`, shortcuts (`?go=solo|daily|duel`), categories, `launch_handler`; (6) game CSS: no pull-to-refresh/overscroll, no tap flash, no text selection outside inputs; (7) `navigator.storage.persist()` so the browser keeps the login token under storage pressure; (8) fonts imported per weight, so the export ships 3 font files instead of 10. **Not done, by rule 8:** Web Push — Chrome delivers it through Google's FCM; notifications stay with the Bale bot.

## D103 — Global chat room and the chat page (2026-10-02)

Owner: «چت شهر باشه، چت کلی هم باشه». A second public room for all players beside the city room (see `chat-and-access.md` §Global room); messages carry the sender's province badge. The chat page follows `screen-chat` of `17 Chat Shop Unlocks`: grape header with two tabs, bubbles (mine highlighted), a strip of canned taunts and the text box. Not built, because the features do not exist: the design's DM and clan tabs, stickers, gift messages and typing indicator.

## D104 — Search screen while queueing (2026-10-02)

Owner: while searching show `screen-search` (diamond), and once a rival is found the 3-second `screen-versus`. The duel now shows the existing `SearchScreen` (with the real queue wait on its clock) until a match is found, then `Versus` counts down. Versus no longer has a searching state in the duel flow.

## D105 — Shop from the design (2026-10-02)

The shop page follows `screen-shop` (see `app-screens.md` §Shop). Departures: only the hint-token tab is live; the other five tabs are shown dimmed with «به‌زودی» rather than left out, so the page keeps the design's shape and the roadmap is visible; the Yalda offer banner (timed bundle) is left out until offers exist.

## D106 — Tournament pages from the design (2026-10-02)

List and detail follow `screen-tournament` (`app-screens.md` §Tournaments). The design shows a fixed three-column bracket; ours has one column per round of the real bracket (scrolls sideways for 16+). Rules, prizes, results and the player list, which the mock-up does not have, sit in a card under the bracket.

## D107 — Profile and settings split (2026-10-02)

The old profile sheet mixed identity and settings. It is now two pages from the designs (`app-screens.md` §Profile and settings): the profile page is read-first with an edit panel behind the pencil; settings holds the device switches and the account actions. Home: the level pill opens the profile, the «تنظیمات» tile opens settings.

## D108 — Leaderboard by XP with city and friends scopes (2026-10-02)

Owner: build screen-leaderboard. Ranked by total XP (the only score we store). Tabs: everyone, my city (the regional filter D53 promised), friends; the design's week / month are replaced because no per-game log exists — add them when game history is recorded. Bots appear like players (D67). `GET /leaderboard?scope=` returns the top 20 and the caller's place.

## D110 — Production deployment stack (2026-10-02)

The repo's `docker-compose.yml` stays dev-only. Production is `docker-compose.prod.yml` + `deploy/` (see `docs/deploy.md`): MySQL on the private network only, a one-shot `migrate` service, the game server (run through tsx because the workspace packages are TypeScript sources), and Caddy serving the PWA build with automatic https and proxying the API on a second hostname (the API routes live at the root, so web and API need separate hosts; `CORS_ORIGIN` is the web host). Images default to a local volume served by the game server; S3 (Arvan/MinIO) is a documented switch. Verified without Docker (no daemon here): the install layout, migrations from an empty database, and the server booting in production mode with its CORS and HSTS headers; the image builds themselves have not been run.

## D109 — Level road from the real gates (2026-10-02)

The level road and locked popup are built from `GET /me/levels` (level, XP curve, and an unlock list assembled from the admin settings `hint.min_level`, `invite.min_level`, `transfer.min_level`, `profile.avatar_change_min_level`, `profile.nickname_change_min_level` and the shop items' `minLevel`), so the screen cannot drift from the rules. Tournaments' own level gates are per tournament and not on the road. Descriptions of the settings-based unlocks are app copy (`fa.levels.unlock`).

## D111 — Daily reward as a wheel, same economy (2026-10-02)

`screen-daily` is built as a spinning wheel over the existing seven-day streak ladder. The wheel always lands on today's reward (the server decides, rule 6), so no economy number changed; the design's random slices (a different prize per spin) would be a new faucet and were not built. **Proposed, owner to decide:** whether the daily reward should become random (weighted slices with an expected value equal to today's ladder) — it would need a config, a ledger reason key and the economy simulation.

## D112 — City hub as a second entry (2026-10-02)

Owner: Home is good as it is; the hub map complements it. Built as an extra page (round map button in Home's top row) that routes to the same modes. Buildings of modes that do not exist (team, propose-and-vote) are shown but disabled. Building art is the design's (`parts`), ported to typed code; the sky is drawn as three flat bands because a gradient fill did not render reliably under the scroll view.

## D113 — Deployment behind the host's existing reverse proxy (2026-10-02)

The owner's server already runs many services on ports 80/443, so the stack no longer binds them: the web container serves plain HTTP on `127.0.0.1:${WEB_PORT:-8081}`, the game server on `127.0.0.1:3000`, and the host's proxy forwards `mrbots.ir` and `api.mrbots.ir` (websockets on) and owns https. Replaces the Caddy-with-certificates arrangement of D110; `deploy/nginx.example.conf` shows the forwards.

## D114 — Owner polish batch 1 (2026-10-02)

Owner notes, first slice: the wordmark's speech bubble moves down; Home's level pill uses the pack's `rosette` instead of a text star; the web build cannot be zoomed (viewport `user-scalable=no`, `touch-action`, iOS gesture and ctrl+wheel/keys blocked); the shop is named «بازار»; the daily reward is the streak card again (the wheel becomes a separate prize, next slice); tables show an item-pack icon instead of free emoji (`TABLE_ICONS`, contract field `icon`, chat card `CODE|icon|name`) and the Tables button opens a two-choice menu (join / create); messages get all / unread / read filters.

## D115 — Presence, friends' private chat, table invites (2026-10-02)

Owner: show who is online, let the host invite friends to a table, and private chat between friends (only after the friend request is accepted). Built: `realtime/presence.ts` counts live sockets per player (two tabs count once); `GET /friends` rows and public profiles carry `online`; the app shows a green/grey dot (`OnlineDot`) on friends, profiles, the invite list. Private chat = chat room `dm` (`roomKey` = both ids sorted), `GET/POST /chat/dm/:friendId`, friends only (`NOT_FRIENDS`), same filter/mute/rate/activation rules as other rooms, pushed live to both players; the Chat sheet has a third tab «دوستان». Table invite = `POST /tables/invite {userId}` (host, friend): a `table` card lands in their private chat (no activation needed, it is structured); an offline friend also gets a Bale nudge «بیا بازی کنیم» (`table_invite`). Migration 0031 adds `dm` to the room enum.

## D140 — 2v2 team mode: free, solo-fill first (2026-10-02, proposed)

Built the team flow of `logic/game-rules.md` §2v2: captain rotates every turn (not on a streak), a teammate's proposal is a live highlight for the captain only, a leaver hands the captaincy over and the team plays on. Proposed defaults, open to the owner: **no entry fee and no coin prize in 2v2 yet** (escrow per teammate/party needs its own economy decision), the queue fills from four strangers (the two longest waiters are teammates), bots fill missing seats after the usual wait. Party of 2 and team rooms are not built.

## D141 — Scheduled puzzle-pool top-up (2026-10-02, proposed)

A timer keeps the puzzle pool at a target (default 30) using the D131 generator. Proposed default: it only fills the **draft** backlog so the admin still writes real titles and approves (the spec's "never auto-publish an un-reviewed title"); a setting `puzzles.autofill_auto_approve` lets the owner switch to publishing straight away with the rule text as title when the solo pool runs dry. Details: `logic/puzzle-generation.md` §Scheduled pool top-up.

## D142 — 2v2 private tables (2026-10-02, proposed)

Private tables gain `format: '2v2'` (four seats, teams of two, host starts when teams are 2+2). Friends choose their team by switching sides; free (no stakes), like all tables for now. A party of 2 joining the public 2v2 queue together is not built; friends who want to play together use a table.

## D143 — 2v2 plays three boards (2026-10-02, proposed)

Owner's idea: a team match should last longer, so instead of one 16-card pack the teams solve three. Built as a series of boards in one match: scores add up, mistakes/lock-outs reset per board, the other side opens each next board, forfeit ends everything. The count is the admin setting `match.team_boards` (default 3). Proposed details to confirm: first-blood bonus only on the first board; the result screen shows only the last board's solution (a per-board recap is not built); no coin prize in 2v2 yet, so a longer match carries no extra payout.

## D144 — The opponent-search grid shows real online players, topped up with bots (2026-10-02, proposed)

Owner: the search screen should pull from online players, or from bots when few. Built as `GET /duel/candidates` (public fields only, no flags); see `logic/matchmaking.md` §Opponent-search show. Proposed: a player's nickname/avatar/level may appear in strangers' search grids while they are online (same fields any opponent sees at match time); the grid is cosmetic and not tied to who the queue pairs.

## D145 — Level table editable in the admin panel; the level road is a winding path (2026-10-03, proposed)

Owner: the level road should be the winding design of `17 Chat Shop Unlocks` (it was a straight list), and the levels and their coin rewards should be set in the admin panel. Built: the winding SVG road, and an admin page «جاده‌ی لول‌ها» to edit each level's start XP and coin reward (table `level_road`; empty table = the old formulas). See `logic/progression.md` §Level table. Proposed: the table replaces the curve, the cap and the every-Nth-level rule once saved; what a level *opens* stays in settings/shop.

## D146 — Profile without scrolling and a player card (2026-10-03, proposed)

Owner: the own profile scrolled and its quick links were plain stacked buttons; a friend's profile was a plain list. Now the own profile fits one screen with an icon-tile grid (recent games moved into a sheet, the editor into an overlay), and another player's profile is a card. See `logic/app-screens.md` §Profile without scrolling.

## D147 — First-run login screen; a gap review (2026-10-03, proposed)

Owner: re-check the designs and docs for what was skipped. Result: `docs/GAPS.md` (designs not in the app, specs not built, content/ops, a suggested order). One gap was closed at once: the designed **login screen** (phone → five-box code → guest), shown once on a fresh install when the server has an SMS provider. Proposed: it never blocks play and never returns after the first choice.

## D148 — Bazaar vocabulary for menu names (2026-10-03, proposed)

Owner: more attractive, more fantasy names — city → قبیله, leaderboard → جارچی, shop → حجره, price finder → (open, proposed «صراف»). Applied in `fa.ts` and listed in `docs/brand.md` §Place names. Extra proposals in the same spirit: chat → قهوه‌خانه, inbox → پیک, private tables → سفره‌خانه, tournaments → جام‌ها, daily reward → عیدی, settings → کارگاه, Bale save → گاوصندوق, city hub → بازارچه‌ی دوزاری (its practice building is now «دکه‌ی تمرین», its team building «چایخانه»). Say the word to change any.

## D149 — Sample catalogue seed (2026-10-03)

Owner: seed some products, prices and puzzles as samples; they will delete them at launch. Built: 119 `sample-*` products with rough, clearly-labelled prices (approved, confidence 1, "نمونه" in every source note — **not researched data**), 10 hand-made puzzles, and up to 20 generator puzzles; `seed --remove-sample` deletes all of it. This is the one place approved prices are not sourced; it exists so the game can be played and the generator tested before the real catalogue.

## D150 — Page headers sit high; the header band grows with the notch (2026-10-03)

Owner: on some pages the back button and title fell on the header's border line. Cause: the coloured band had a fixed height while the title row moved down by the device's top inset. The band now grows with the inset and the row starts closer to the top; the opponent-search status is one line. See `logic/app-screens.md` §Page headers.

## D151 — The 2v2 search looks for three players (2026-10-03)

Owner: in 2v2 the search screen must look for three players, not one. The panel now shows a teammate «؟» next to you and two rival «؟», and the found-screen shows all four; `match:found` gained `youId`. See `logic/app-screens.md` §Searching for a 2v2.

## D152 — The icon pack is generated from the design files, with categories (2026-10-03)

Owner keeps updating the icon pack and wants categories in the admin. `packages/shared/scripts/gen-items.mjs` rebuilds `items/data.ts` (157 icons, was 57) and `items/groups.ts` (14 groups with Persian names, from designs 12 and 14) from `docs/design`; never edit them by hand. The admin icon picker has category chips and searches Persian and English names; the dev gallery lists the same groups.

## D153 — An endless search is explained, and bots are made on their own (2026-10-03)

Owner: the opponent search never ends. Cause: with no approved puzzle or no bot account the queue silently waits. The server now pushes `queue:status` every 4 s with an optional `problem` (`no_puzzles` / `no_bots`), the app shows it, and the bot driver tops the roster up to `bots.autofill_min` (default 12). See `logic/matchmaking.md` §Why a search can seem endless, `logic/bots.md` §Roster top-up. Proposed default: 12 bots; set 0 to switch off.

## D154 — The wheel is always there and has more sources (2026-10-03)

Owner: the wheel should always be reachable, with a spin item, hidden steps, tournament prizes and a daily option. Home has a round wheel button (badge = spins waiting). Spins come from a won duel, a free daily spin (`wheel.daily_spins`, default 1), shop items with effect `wheel_spin`, the level table's `reward_spins`, and tournament prizes (`spins` per place). Migration 0040. Proposed shop prices: 25 coins per spin (an average spin pays about 13). I read «روزانه» as the daily free spin; tell me if it meant something else. See `logic/economy.md` §Lucky wheel.

## D155 — Failure cards (2026-10-03)

Owner: the friendly error card from the design should show when the server cannot be reached. `ErrorCard` (design 10) now covers the live duel and the solo screen; other screens keep their line for now (open item in `GAPS.md`).

## D156 — Owner backlog of 2026-10-03 and the wheel's spin policy (2026-10-03, proposed)

Owner listed six follow-ups to start after the first Android build (`docs/logic/owner-backlog-2026-10-03.md`, `PLAN.md`). One is a policy: the wheel
should be able to pay every prize kind (gems, clothing, hats …), and **no one gets free spins for now**; later spins behave like lives (a small refilling
stock) while prizes stay valuable. Until the owner confirms, nothing changes in code; the proposed first step is `wheel.daily_spins` = 0 when item 1 is built.

## D197 — Phone-only gate, landing site and short domain (2026-10-03, proposed)

Owner added three items to the backlog (`docs/logic/owner-backlog-2026-10-03.md`, items 7–9), none started: (7) the desktop web layout is unsuitable, so a
non-phone browser shows a «come with your phone» card with a QR code (Android → downloads, iPhone → PWA install); (8) `mrdozari.ir` becomes a separate
landing + blog project in this repo (`apps/landing`, its own container, content managed from the admin panel, full SEO/GEO using the owner's spreadsheet,
adapted from Laravel to this stack); (9) `2oi.ir` is the short domain for outgoing links via a self-hosted shortener, and every domain becomes an admin setting.
The app's own domains (`mrbots.ir`, `api.mrbots.ir`) are unchanged until the owner decides otherwise.

## D158 — Admin panel tidy-up (2026-10-03, proposed)

Owner added backlog item 10: restructure the admin panel UI for readability — categorised sidebar, explanatory text per page, and «add» flows as modal forms. UI-only; admin API contracts are unchanged. Not started; the owner names the order.

## D159 — Faster opponent search (2026-10-03, proposed)

Backlog item 5: the human-wait before a bot fills a 1v1 seat drops from 25 s + up to 15 s jitter to 8 s + up to 4 s jitter (`bots.fallback_seconds` / `bots.fallback_jitter_seconds`, minimum now 3 s). The driver polls every 5 s, so the real wait is 8–17 s. Values already saved in the admin settings keep winning; lower them there to tune. Bot-fill rules in `logic/bots.md` are unchanged.

## D160 — Birth date in the profile, with a «show my age» tick (2026-10-03, accepted values)

Owner asked for the birth date to be collected in the profile, with a checkbox for showing or hiding the age, minimum age **10**, and a birthday week: from 3 days before the birthday for 7 days the profile is in a party look and the player can claim a gift set in the admin panel (starting values 100 coins, 5 gems, 2 wheel spins). Full policy in `logic/profile-and-identity.md`. Date never leaves the server; age shown to others only with the tick (default off). Gems are not in the economy yet, so that part rides on backlog item 1. Not built.

## D162 — The icon pack grows to 236 icons; sample products get their own icons (2026-10-03)

The designer's update (`Item.dc.html`, `Dozari - 14 Product Icons.dc.html`; the duplicated `… copy.html` files were folded into the originals) adds 79 icons: the 67 hand-drawn ones plus 12 built by the new `CAR` / `BOWL` / `TIX` helpers (taxi, Paykan, Pride, Samand, Peugeot 206, vanet, bus ticket, ash, halim, nuts …). `gen-items.mjs` now reads builder entries, types the helpers, exports the design's slug → icon map as `SAMPLE_ICONS`, and files every icon under a category (the design's «نمونه‌ها» groups use the product names). A new test checks that every path is valid, every icon sits in exactly one category and every sample slug maps to an existing icon. The sample catalogue's `icon_key` values follow the designer's map (107 products changed or filled in). Databases that already hold the sample catalogue keep their old keys until the seed is re-run or the icons are changed in the admin catalogue.
## D161 — Profile-completion rewards (2026-10-03, proposed)

Backlog item 3. Home's guide character nudges the next missing profile step and pays a one-time coin reward, set per step in the admin panel (proposed defaults: gender 10, city 20, verified phone 50, Bale link 30). Steps are checked on the server; claims are idempotent (`profile_task_claims` + ledger reason `profile_task`). Nickname and avatar are not steps because every account gets them at signup. The sizes are mine to propose and the owner can change them in «تنظیمات ← اقتصاد».

## D163 — Missions (2026-10-03, proposed rewards)

Backlog item 4. Missions reuse the profile-task service (D161): the list now holds the four profile steps plus `first_win`, `invite_friend` and three honour missions (Instagram follow, channel join, store review). Server-checked ones pay only when true; honour missions are always claimable once and carry small rewards; all claims are idempotent (`profile_task_claims`, ledger reason `profile_task`, label «ماموریت»). Rewards are mine to propose and the owner edits them in «تنظیمات ← اقتصاد»: first win 25, invited friend 100, Instagram 15, channel 15, store review 40. Home gets a «ماموریت‌ها» tile. `link.instagram` and `link.channel` are settings; an empty link hides its mission.

## D164 — Gems (الماس), birthday badge for all, friends told (2026-10-03, proposed)

Owner: gems are a second currency used for many things, mostly shop purchases, and some tournaments take gems as the entry fee; the birthday badge shows to everyone; friends get a message that it is someone's birthday. Proposed: gems live beside coins with their own append-only `gem_ledger` and balance (never `UPDATE`; one service function; same idempotent-key rule as coins, CLAUDE.md rule 6), prices of shop items and tournament entry fees get a currency (`coins` | `gems`), the wheel and the birthday gift can pay gems. Gems are earned only through such gifts and prizes at first, not sold. Not built; it is backlog item 12 and item 1 (wheel prizes) and 11 (birthday) wait on it. The birthday-week details (badge for all, friends' messages with an opt-out tick, gift in the admin panel) are in `logic/profile-and-identity.md` (D160).

## D165 — Wheel prize table, cosmetics and real-money prices in the shop (2026-10-03, proposed)

Owner: whatever the shop sells goes on the wheel too, and the wheel also pays clothing and hats; in the shop (حجره) each item may carry a coin price *and* a real-money price. Rest left to us.
Built now: the wheel is a typed table `wheel_prizes` (kind `coins | gems | hint_token | wheel_spin`, amount, weight, active), seeded from `WHEEL_SLICES_DEFAULT` and edited in the admin page «گردونه‌ی شانس»; the server pays each kind through its own service (coin ledger, gem ledger, inventory, a new spin row). **No free spins**: `wheel.daily_spins` default 0 and the new `wheel.win_spins` default off, so spins come only from shop purchases, level, tournament and gift prizes (saved admin settings override these defaults).
Next, in order: (1) cosmetics — a catalogue of hats/clothing (`cosmetic_items`, per-user ownership, shop tabs «لباس»/«آواتار», wheel kind `cosmetic` that pays coins instead when already owned); (2) shop items get an optional real-money price (rials + store SKU) next to the coin/gem price, paid through the existing store-purchase verification of `coin_packages`; (3) «spins as lives» stays unbuilt until the owner picks the refill rate.
Built (cosmetics, stage 1): cosmetics are ordinary shop items with effect `cosmetic` and a slot (hat / outfit / accessory), so price in coins or gems, level gate and admin editing are shared; a player owns one copy (`user_cosmetics`), wears one item per slot, and the worn items draw on the profile avatar (other players' avatars not yet). Wheel kind `cosmetic` points at such an item; a repeat pays `wheel.cosmetic_dupe_coins` (default 50) instead. Art uses the existing pack icons (hat, crown, shirt, dress, scarf) until the owner supplies real clothing art.


## D166 — Launcher icon follows the player's gender (2026-10-03, proposed)

Owner: the app icon changes with the gender setting. Proposed: two Android launcher entries (activity-aliases `MainActivityDefault` and `MainActivityFemale`, added by `apps/mobile/plugins/withGenderIcon.js`); the female hero's face (`assets/icon-female.png`, `adaptive-icon-female.png`, exported by `scripts/export-brand.mjs`) is the icon for «female», every other value (male, unset) keeps the original hero, as `heroFor` does in the app (D68). The home screen switches it after the profile loads and when the player changes gender, through the local Expo module `apps/mobile/modules/app-icon` (`setComponentEnabledSetting`, no restart). Android only; the launcher may take a few seconds to redraw and a few launchers briefly show both icons or close the app. No icon for «male» of its own yet (the original hero is already male); say if one is wanted.

## D167 — New app icon, stepped search clock, Home pill spacing (2026-10-03)

Owner updated `Dozari - 03 Brand.dc.html`: the app icon is now a warm yellow-orange sunburst with a gold coin and the waving hero (male and female variants), replacing the violet backdrop. `BrandArt.tsx` follows it and every icon in `apps/mobile/assets` and `public/` was re-exported (`?brand` on the web build opens the brand sheet for `scripts/export-brand.mjs`). The Android foreground is drawn at 90% so the coin rim stays inside the adaptive-icon safe zone. The opponent-search waiting time now moves in 3-second steps instead of every second; Home's stat pills are 40 px tall with a smaller icon and padded numbers.

## D168 — Live friend-request and inbox pushes, server-down notice (2026-10-03)

Owner: friend requests did nothing on screen, notifications had no socket, and a dead server showed nothing calm. Decision (answering «does a socket add load?»): idle Socket.io connections are cheap (a few KB each plus a ping every 25 s), far cheaper than polling the database, and the gateway already runs one room per user, so Home now opens one quiet socket (no queue, no match) after the splash. The server pushes `notice:new` (`friend_request` with the sender's nickname, or `inbox`) to the addressed player only; nothing is stored — an offline player sees it on the next load. The app shows a bottom sheet «درخواست دوستی تازه» (see / later) that opens the friends list, also for requests already waiting at launch, and reloads the inbox on an `inbox` push. The same socket makes the player show online to friends. If it ever hurts (thousands of idle sockets on one node), fall back to a 60-second poll of a tiny counts endpoint. Separately, `callJson` reports every call to `net/health`; two failures in a row (no connection or 502/503/504) show a calm yellow strip «ارتباط با سرور برقرار نیست؛ نگران نباش، به‌زودی برمی‌گردیم» that re-checks `/health` every 15 s and hides itself.

## D169 — Birthday built (2026-10-03)

Item 11 is built as D160/D164 specified: optional Solar Hijri birth date (min age 10, real days only, 30 Esfand celebrated on the 29th in a year without a 30th), age derived and shown only with the tick, the party badge for everyone in the week (3 days before + the day + 3 after), friends told once at the start and once on the day (opt-out tick, default on), and a once-a-year gift (100 coins, 5 gems, 2 wheel spins) that is an admin setting. Amounts, minimum age and week length live in `birthday.*` settings (rule 9). Friend messages are one shared inbox message per event with all friends as recipients, delivered by a 2-hourly job.

## D170 — Shop items for real money (2026-10-03)

Owner: each item in the حجره may carry a real-money price next to its coin or gem price. Built: `shop_items.price_rials` (0 = not sold for money), `sku_bazaar`, `sku_myket`; table `shop_real_purchases` (unique store + order id = replay lock; migration 0048). Paid either through a Bale wallet invoice (payload `si:<item>:<user>`, confirmed only by Bale's `successful_payment`, the pre-checkout checks payer, item, level and exact price) or a Bazaar/Myket receipt the server verifies (`POST /shop-pay/:id/redeem`, the verifier is the same refusing placeholder as coin packages until a store adapter is wired). The item is granted by `ShopStore.grantPaid` (tokens, spins or a cosmetic; a cosmetic is sold once); no coins or gems move. Everything under `/shop-pay` sits behind `feature.coin_packages` (default off); the app shows a «N تومان» button on an item only when that switch is on. Admin edits the toman price (stored as rials = toman × 10) and the SKUs on the shop page. Also fixed: the puzzle-draft generator stopped the whole run after one failed draw (flaky admin test).

## D171 — Phone-only gate (2026-10-03)

Item 7 built for the web build only (native builds and an installed PWA always pass). `gate.phone_only` (admin setting, default on) turns it on; a desktop browser then shows the «با گوشی بیا» card with a QR of `link.app_url` (empty = the page's own address), an Android phone shows a download card with `link.android_app` (hidden while empty), an iPhone shows the three Safari install steps (the same steps as the install sheet of D102). Every card has «ادامه با مرورگر» (remembered in `dozari.gateContinue`; `?browser=1` does the same) so testers and anyone who insists can still use the browser. Detection is by user agent (iPadOS posing as a Mac counts as iOS). The QR comes from the small dependency-free `qrcode-generator`. Also fixed in the same change: `I18nManager.swapLeftAndRightInRTL` (added for native RTL) does not exist on react-native-web and crashed the whole web app at load, so it is now called on native only.

## D172 — Short domain and domain settings (2026-10-03)

Item 9 (stage 1): self-hosted short links under the admin-managed short domain (`docs/logic/short-links.md`), plus the four domain settings. Redirects are 302 and uncached so edits apply at once. The reverse-proxy/DNS part for `2oi.ir` is the owner's; until then `/s/<code>` on the API host works for testing. The landing site (item 8) comes next as its own app.

## D173 — Landing site content (item 8, stage 1: the content backend) (2026-10-03)

The landing site `mrdozari.ir` is a separate app (`apps/landing`, next change) whose content the admin manages in the game's panel: blog posts in Markdown (`landing_posts`, draft/published, own meta title and description, cover, author; a renamed slug keeps the old one in `landing_slug_redirects` for a 301), the cast page (`landing_cast`), and FAQ pairs (`landing_faq`), plus `landing.*` texts in the settings (name, tagline, hero title and text, contact e-mail). The landing app reads only the read-only `GET /public/landing`, `/public/posts`, `/public/posts/:slug`, which stay up in maintenance mode. Drafts and hidden rows never leave the server. Admin pages: «بلاگ»، «بازیگران»، «سوالات متداول» (group «سایت معرفی»). The SEO/GEO sheet the owner promised will refine page copy and structured data; the technical SEO rules (one h1, canonical, JSON-LD graph, sitemap, robots, llms.txt, 301 on slug change, real 404) are implemented in the app itself.

## D174 — The landing app (item 8, stage 2) (2026-10-03)

`apps/landing` is built: a small Fastify server-rendering the home page, blog, cast, `sitemap.xml`, `robots.txt`, `llms.txt`/`llms-full.txt` from the game server's public content API (D173), in its own container (`deploy/Dockerfile.landing`, compose service `landing`, loopback port `LANDING_PORT`, domain `LANDING_DOMAIN`). It keeps a 60-second cache and serves the last good answer if the game server is down. Technical SEO/GEO is built into two modules (`seo.ts`, `pages.ts`) and tested; the page copy, keywords and any extra pages wait for the owner's spreadsheet, DNS and the proxy forward are the owner's steps (`docs/logic/landing-site.md`, `docs/deploy.md`).

## D175 — Gem prizes in tournaments, wheel spins that refill like lives (2026-10-03)

Tournament places can now pay gems next to coins and spins (`tournament_prizes.gems`, cap 500 per place, paid through the gem ledger with reason `tournament_prize`; admin builder has the three fields; the app's prize line shows them; migration 0051). The «spins behave like lives» policy of D156 is built but **off by default**: `wheel.refill_hours` (0 = off) and `wheel.refill_cap` (default 3) give one spin per window while fewer than the cap are waiting, granted when the player opens the wheel (so nothing accumulates while away; the window number is the idempotency key, source `refill`). The owner picks the hours when they want it; until then no one gets free spins. Obsolete PR #93 (emoji seed icons, replaced by the 236-icon pack) was closed.

## D176 — Wearables drawn on the whole character (2026-10-04)

Proposed default. Cosmetic slots grow to `hat|outfit|accessory|hair|glasses`. The art is vector, drawn on the character itself (`apps/mobile/src/components/wearArt.tsx`, used by `Character` through a `worn` prop): hats (`shapoo`, `crown`, `beanie`), hair (`hairLong`, `hairCurly`, `hairBun`), glasses (`glassesRound`, `glassesSun`), clothes (`shirt`, `dress`) and a scarf. A shop item's `iconKey` names the art (old key `hat` = `shapoo`); `Item` shows a wearable on a plain face, so the shop, wheel prizes and purchase popup need no extra code. Worn hair or hat replaces the character's own head gear. The own profile shows the full-body character; avatars (face crop) and the public profile (`PlayerProfile.worn`) show head items. Six new default shop items (coins or gems, admin-editable). Not yet: worn items on leaderboard/friend/chat avatars (they would need `worn` in those lists).

## D177 — Reports, price feedback and the suggestion engine (2026-10-04)

Proposed defaults. **Reports**: a profile has «گزارش این بازیکن» and a chat message's «گزارش» opens the same dialog — a reason from a list (توهین، اسپم، تقلب، اسم/عکس نامناسب، دیگر) plus a free description. Profile reports go to `user_reports` (one open report per reporter and target, `report.daily_limit` a day); chat reports keep going to `chat_reports` with the reason text. Admin pages «گزارش بازیکن‌ها» and «گزارش‌های چت». **Price feedback**: a «قیمت اشتباهه؟» link under a price (price-guess result, price lookup) opens the suggestion form for that product: «اشتباهه» (`price_report`, a note and optionally a better price) or «قیمت پیشنهادی دارم» (`price_point`). **Suggestions** (`docs/logic/ugc.md` phase 1): `ugc_submissions` (`item`, `price_point`, `price_report`) with votes in `ugc_votes`; voters need `ugc.voter_min_games` finished games; score ≥ `ugc.approve_score` → admin queue, ≤ −`ugc.reject_score` → rejected; max `ugc.daily_limit` a day; an existing item is detected by normalized name. Approval hands an item to the catalog as a new product plus a **pending** price (the existing price review still decides) and pays `ugc.reward_coins` once through the ledger (`ugc_reward`); a price report approval only pays — the admin fixes the price in the catalog. Entry: the hub's «مکتب‌خانه». Not yet: photo upload, the outlier guard (price > 5× neighbours), a Home-screen card.

## D178 — Solo excitement: combo with timer ring, near-miss pill, last-life heartbeat (2026-10-04)

Owner picked both items of the handoff's «C». Proposed defaults: **combo** = groups solved in a row, each within `COMBO_WINDOW_SECONDS = 25` of the last (shown from ×2 in the top bar, ring = time left to extend it); it is purely visual and sonic, so solo stays practice (no points, no coins, server untouched). A wrong or one-away guess ends it. **«یکی مونده!»** becomes a pill that pops over the board (the message already existed). **Last life**: the remaining dot beats, the label reads «آخرین فرصت!», a lub-dub sound/vibration repeats every `LAST_LIFE_HEARTBEAT_MS = 1100`. Numbers live in `packages/shared/src/config/game.ts`; the pure combo rules are in `game/combo.ts` (tested). Duel screens are unchanged. Not seen on a real phone yet. Later ideas (friend ghost times, nightly rule, boss rounds) stay unbuilt.

## D179 — Fitting room: the character's items leave the hujre (2026-10-04)

Owner: the cosmetic pack («21 Cosmetic Packs») belongs to a *fitting room* («پرو» as in the design's try-on) where players build their own character, and the hujre keeps only non-character items; prices are the owner's call per item (free, coins, gems or real money). Done: the hujre loses the «لباس» and «آواتار» tabs; a new Home tile opens «اتاق پرو» (stage with the player's character, worn chips, slot tabs, shelf, free try-on, then wear / buy / pay). **Proposed defaults** the owner can change: (1) one tab per existing slot (کلاه، مو، عینک، لباس، زیورآلات) — the pack's extra packs (تاج، ریش و سبیل، رنگ پوست، بج) need new slots and art and are not built; (2) the male/female model switch of the design is dropped, the character follows the profile gender; (3) bundle discounts («پک ۴۰٪») are not built; (4) the server API is untouched — cosmetics are still `shop_items` priced in the admin panel. Art for new items comes through the SVG pipeline (`apps/mobile/assets/wear/README.md`). Not seen on a real phone.

## D180 — SEO and link fields move into the admin panel (2026-10-04)

Owner: everything that was «owner's side» for SEO/GEO and links is entered in the admin panel. Links and domains were already settings (`link.android_app`, `link.app_url`, `domain.*`); new group «سئو و سایت معرفی» holds the landing site texts and the new fields listed in `docs/logic/landing-site.md` §SEO fields (home title/description, keywords, og image + alt, extra sameAs, web font URL, indexing switch, Google/Bing/Yandex verification). **Proposed defaults:** indexing on, og image = generated `/og.svg` card (social crawlers prefer PNG/JPG, so set one), no web font. The per-page copy of the owner's spreadsheet beyond these fields (new pages, per-page titles) still needs the spreadsheet itself.

## D181 — Plan audit, signup bonus, settings wiring, privacy page, ops hooks (2026-10-04)

Owner: check the old plan and do what remains. Audit result: most Phase 4–8 boxes were built but unticked (ticked now). Built in this pass: **signup bonus** (`economy.signup_bonus`, 200 default, once per new account through the ledger; existing accounts are not paid retroactively); **match numbers from settings** (turn seconds, mistakes, timeouts, group points, first blood; frozen per match in `MatchState.rules`) and **chart limits** from `GET /config`; **invite button** on the duel result; **privacy policy page** `/privacy` on the landing site (facts from the schema; please have the text reviewed before store submission); **self-hosted error reports** (`SENTRY_DSN`), **analytics script hook** (admin settings), **backup + restore-drill scripts**. Still open: competitive price-guess round and wager, bot subsidy, share card, `user_tags` (badges cover most of it), load test, store listings, the Phase 0 spikes (need real network/hosting), and catalogue / puzzle content.

## D182 — Share card for the result chart (2026-10-04)

PLAN Phase 3 «share card». Built as described in `docs/logic/result-chart.md`: off-screen `ShareCard` + `react-native-view-shot` + `expo-sharing` on phones; text-only share with the invite code on the web build (no capture there, platform files `shareCapture(.native).ts`). Added dependencies: `expo-sharing ~57.0.22`, `react-native-view-shot 5.1.0` (the SDK's bundled versions); both the web and the Android Metro bundles build. The share button sits under the solo result chart only; the short URL line and the duel result are still open.

## D183 — Makeup pack (slot `makeup`) (2026-10-04)

The owner added the makeup pack to the design («21 Cosmetic Packs», `Character.dc.html` `MK`). Built as a **code-drawn** sixth cosmetic slot, not as SVG files, because the pieces follow the face (the lip colour strokes the current mouth shape, shadow and liner only show while the eyes are open): `apps/mobile/src/theme/makeup-data.ts` (a port of the design) and `components/makeupArt.tsx`, drawn at the design's depths inside `FaceArt` (blush/shadow under the eyes, liner over them, lip under the mouth fill, gloss over it, paint and dots after the nose). 13 items: blush, 3 lipsticks, mole, 2 shadows, cat liner, hearts, stars, glitter, tiger, full glam. `COSMETIC_SLOTS` gained `makeup` (migration **0054**, admin slot select, fitting-room tab «آرایش»); default shop rows use the design's prices (300–1000 coins, 30–90 gems) and levels 2–10 — the owner reprices them in the admin panel. Also fixed: `db:generate` could not load the schema since the slot list came from `@dozari/shared`'s index; the list now lives in `packages/shared/src/economy/slots.ts` (no imports) and the schema imports that file directly. The design's other new packs (crown, beard & moustache, skin tone, jewellery, badge) are still not built.

## D184 — Price-feedback card: icon button, compact form, visible scrollbar (2026-10-04)

Owner: the suggestion / «price is wrong» card scrolled without showing it, and the text «قیمت اشتباهه؟» should be a nice icon. Done: `PriceFeedbackLink` is now a round yellow button with the new `priceAlert` icon (a price tag with «!»; label kept for screen readers) on the result of a price-guess round and the price lookup; the form (`FormDialog`) keeps scrolling when it must but its bar is always visible (`persistentScrollbar`), and the price form is denser (amount and unit on one row, shorter note box). Not seen on a real phone.

## D185 — City hub: tapping a building opens its bottom drawer again (2026-10-04)

Owner: the hub without the bottom drawer looked worse; tapping an icon should open that building's menu. The change of #128 («the hub opens modes directly») is undone: a tap always raises the drawer (host, description, «ورود» / «به‌زودی», close), as `docs/logic/app-screens.md` §City hub always said. Entering is the drawer's button.

## D186 — Age in the profile and the admin (2026-10-04)

Owner: age was not handled in the profile. The birth date, the age tick and the birthday week were already built (D160); what was missing is now added: the own profile shows the age; the admin user sheet shows age (owner role: also the exact date); the dashboard shows age-band counts. Rules unchanged: age is derived, others see it only with the tick, the date never leaves the owner view.

Also in this commit: the new seed file `products-2026-10-04-01.json` made `db` tests fail (nan-sangak 1359 = 26 rials, then 15 rials in 1364: a 42% nominal drop, with the 1359 note saying «بر حسب وزن»). That point is set to `pending` with a note until someone checks the unit; the rest of the file is untouched.

## D187 — Fitting room rebuilt after the design (2026-10-04)

Owner: the fitting room was not like the design and the level text («از سطح ۲») sat outside the card. Rebuilt (`apps/mobile/src/wardrobe/`: `FittingRoom`, `WardrobeStage`, `PackCard`, `RadialFill`, `rarity.ts`) as described in `docs/logic/app-screens.md` §Fitting room: sunburst stage, worn chips, a chip per pack, pack sections with rarity-tinted cards, price buttons with coin/gem icons, the level as a chip inside the picture. Checked in headless Chromium with react-native-web at 390×780 and 360×640 (mock shop data; not on a phone). **Proposed defaults:** rarity is derived from the price (no DB column yet); the bundle buttons («پک ۴۰٪ ارزان‌تر») are **not built** — they need a decision on the bundle price rule and a new ledger reason; the model switch is dropped. Packs the design has and the app has no slot for (crown, beard & moustache, skin tone, badge) are still open.

## D188 — Domains back to mrbots.ir / api.mrbots.ir (2026-10-04)

D188 (moving the app to `2oi.ir` / `api.2oi.ir`) is **withdrawn**: the owner found `2oi.ir` unreachable from Iran, so the phones could not connect to the server. Everything is back on `mrbots.ir` (web) and `api.mrbots.ir` (API), including the Android release default address and the APK workflow. `2oi.ir` stays the separate short-link domain (D172); the host-equals-app special case of the move is gone with it.

## D189 — The owner's two songs are the app music (2026-10-04)

`docs/music/background.mp3` (4:00) and `competition.mp3` (3:30) are re-encoded to 80 kbps (≈ 2.4 / 2.1 MB, `apps/mobile/assets/music/`) and loop through `expo-audio` on phones **and the web**: the background song plays under every screen except a match, the competition song during one (`useMusic` in `App.tsx`, mood `calm` / `tense`); the settings «موسیقی» / «صدا» switches still apply. If a song cannot be played the old synthesised loop of that mood takes over on phones. Browsers block sound before the first tap, so the web retries on the first touch. The two files are above the PWA precache limit (2 MB) and load on first use. Not heard on a real phone/browser here.

## D190 — Streak pill only when there is a streak; the competitive price round is deferred (2026-10-04)

The Home pill «🔥 N روز» is the **daily puzzle streak** (consecutive days the daily puzzle was solved; it feeds the daily bonus, `docs/logic/daily-puzzle.md`). Showing «۰ روز» confused the owner, so it now appears only from a streak of 1. **Deferred, not built:** the competitive price-guess round with the coin wager and the bot subsidy (PLAN Phase 3-A / 6, GAPS B1). It touches the live match flow (a new phase after the board, hidden entry + simultaneous reveal for both sides and for 2v2 captains, escrow per round, bots that must guess, reconnects) and cannot be exercised end to end in the cloud container (no MySQL, no phones), so shipping it blind could break every duel. Proposed path when the owner wants it: (1) server phase behind a switch `duel.price_round` (default off), (2) bot guesses, (3) wager through the ledger with `price_guess_wager` / `price_guess_payout`, (4) client hidden-entry screen and reveal, (5) try it on the owner's server with the switch on for a few testers, then default it on.

## D191 — Animated logo (2026-10-04)

The owner's logo animation (`docs/design/Dozari - 23 Logo Animation.dc.html`, `Logo.dc.html`) is `apps/mobile/src/components/AnimatedLogo.tsx`: the coin falls spinning and lands with a squash and one rebound (1 s), the wordmark pops in with a squash-stretch at 0.45 s, six candy sparks burst out, the wordmark keeps breathing (3.2 s loop) and a shine sweeps over the letters every ~3.6 s. «حرکت کمتر» shows the finished logo. Used on the **splash** and **login** screens (the static `Wordmark` stays on Home and in the share card). Checked frame by frame in headless Chromium (react-native-web); the shine is drawn with an animated gradient that react-native-web does not animate, so it is only seen on phones — not verified on a phone here. The style sheet (`22 Style Sheet`) is the theme still to be applied to the landing site.


## D192 — Fitting room list is a recycled FlashList (2026-10-04)

Owner: scrolling the fitting room was not smooth. All cards (each with several SVGs and shadows) were built at once inside a `ScrollView`. The list is now a `@shopify/flash-list` (2.3.3, JS-only, no Google deps) of flat rows — a header row per pack, then the cards two to a row — so only the visible cards exist and rows are recycled. Pack chips jump with `scrollToIndex`. The rounded frame around each pack is dropped (a flat list cannot wrap a group). Not measured on a phone.

## D193 — Animated logo without the shine; forced LTR box (2026-10-04)

Owner: on the phone the logo did not animate and sat to the left. Likely cause: the shine animated the SVG `LinearGradient` through `setNativeProps`, which has no native view in the new architecture and breaks the JS-driven frame updates. The shine is removed (the coin drop, pop, sparks and breathing stay, all on the native driver), and the logo box is `alignSelf: 'center'` with `direction: 'ltr'` so the forced RTL cannot move its parts. Not seen on a phone yet.

## D194 — Hub drawer slides up and down (2026-10-04)

Owner: the building drawer of the city hub appeared at once. It now rises from the bottom (320 ms, ease-out) with the dim layer fading in, and sinks again on close (220 ms); «حرکت کمتر» keeps it instant. Native driver only. Not seen on a phone yet.

## D195 — Hub drawer is a full bordered card; animated logo has pixel sizes (2026-10-04)

Owner: the hub drawer had only a purple border on top (a top-only border with rounded corners draws as a tapering crescent on Android), and the splash logo sat a little left of the centre. The drawer is now a floating card (10 px from the sides, 12 px from the bottom) with a 4 px ink border all round, a hard shadow and fully rounded corners. The animated logo's SVG gets the box's pixel width / height instead of `100%`, as the static wordmark has, so its viewBox is centred the same way. Not seen on a phone yet.

- **D196 — Hub drawer motion is a spring.** Opening uses `Animated.spring` (damping 22, stiffness 150, clamped, native driver) instead of a 320 ms cubic ease; closing is a 280 ms Material standard bezier. Smoother start/stop, same native-driver cost.

- **D197 — Animated logo on Home, centred as a group.** The Home screen uses `AnimatedLogo` (as Splash and Login do) instead of the static `Wordmark`. Inside the animated logo the lettering and the coin are shifted right together (~0.04 × width) so the coin-plus-lettering group, not the lettering alone, sits at the centre of the box.

## D196 — Price-guess round after the 1v1 duel, behind a setting (2026-10-04, proposed)

The owner-approved bonus round (D-series 2026-09-27) is now built for live 1v1 duels, **off by default** (`match.price_round`) so nothing changes until the owner
switches it on and has seen it on a device. The puzzle winner stands; the rounds only break a tie and give a locked-out side a small bonus (rules already in
shared). The per-round coin wager is built too, behind its own setting `duel.price_wager` (0 = off, queue duels only, 2–5 coins proposed): owner picks the number after checking the economy simulator, which does not model it yet. 2v2 keeps the
puzzle-only ending until the captain-pooled guess is designed. Details: `docs/logic/price-guess-round.md` §As built.

- **D198 — Terms page.** The landing site serves `/terms` (قوانین و شرایط) next to `/privacy`: conduct, chat, in-game-only coins, suggestions, bans, liability. In the sitemap and footer. Plain-language draft, not legal advice: the owner should read it before the store review.
- **D199 — Admin-defined puzzle tiers, level-aware serving (proposed).** The fixed آسان/متوسط/سخت of D34 becomes an admin-edited list (`puzzle_tiers`: name, order, player-level range; five defaults 1–3 / 4–8 / 9–15 / 16–25 / 26+). Each puzzle carries an optional `tier_id`; solo serves the signed-in player's level, a duel the higher of the two. No rated puzzle for that level → any approved puzzle. The level ranges are guesses: tune them in the admin after playtesting. Details: `docs/logic/progression.md` §Puzzle tiers.
- **D200 — Free idle nudge for level-1 players (proposed).** After 20 s without a move in a solo game, two cards of one unsolved group light up softly (server-side, free, max 2 per game, level ≤ 1). Numbers in `config/game.ts`.
- **D201 — Offline solo is practice only; data pages are cached (proposed).** The app keeps 5 whole puzzles for playing without internet and shows cached copies of the data pages while refreshing them. Because a saved puzzle contains its solutions (an exception to rule 4), offline games grant no XP, coins or stats and are never synced; the download endpoint is signed-in only and capped at 15 puzzles per day. Details: `docs/logic/offline-solo.md`.
- **D202 — Live duel opens at level 3 (proposed).** `duel.min_level` (default 3, admin-editable) gates the 1v1 and 2v2 queue on the server; solo, daily, price-only, friend tables and bots are not gated. Details: `docs/logic/matchmaking.md` §Level gate.
- **D203 — Sponsors on tournaments (proposed).** Admin-defined `sponsors` (name, tagline, story, https banner/logo/link, accent, active switch) chosen per tournament (`tournaments.sponsor_id`); shown as a tag in the list and a card with banner on the tournament page. A «want to sponsor?» card at the end of the list is driven by three admin settings and hidden without a contact link. Images are pasted https links for now (no upload). See `docs/logic/sponsors.md`.


## D198 — Age tracks: kid, teen and adult spaces (2026-10-05, proposed)

Owner: one game for every age. Kids get an educational space (very easy picture puzzles, no price guessing, then a word lesson: the word and its
letters). The player picks an age band on first run; a kid or teen is linked to a guardian by phone OTP, and one guardian number can hold several
child profiles. Adults must never feel they are in a kids' game, and the admin panel must let every list be filtered and managed by band.
Proposed defaults in `docs/logic/age-tracks.md`: three bands (up to 11 / 12–17 / 18+) chosen, not computed, with no birth date used for it (the D160 birth date stays optional and independent); kid and teen
have no free chat and no coin wagers, match only inside their band, and cannot raise their own band; kid content needs an editor's approval. Nothing
is built yet. Owner to confirm: band edges, whether the guardian step is a hard gate for kids, and store age-labelling rules for Bazaar/Myket.
