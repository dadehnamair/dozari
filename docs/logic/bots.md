# AI opponents ("bots") in matchmaking

Owner-approved (2026-09-27): the game maintains a pool of **AI-controlled player accounts** that
fill matchmaking whenever a real opponent isn't available, and they are **never disclosed** as
bots — they must look and behave like real users to the humans they're matched against.

This is a real product/ethics tradeoff (undisclosed AI opponents playing for coin stakes). It's
recorded as an owner decision (D19 in `docs/DECISIONS.md`), not something Claude decided alone;
the fairness mechanics below (§Economy interaction) exist specifically to keep it from being
a disguised way to take players' coins.

## Why

- Matchmaking (`matchmaking.md`) is FIFO with no rating; at low concurrent user counts a real
  opponent may not appear for a while. Bots guarantee a duel/team match is always available,
  which matters a lot for a new app's early retention.

## Account model

- A bot is an ordinary row in `users`, flagged `is_bot boolean` — internal only. No API response,
  socket payload, or `toClientView` output ever includes this flag or any bot-specific field;
  from the client's perspective a bot is indistinguishable from a human `match_players` entry.
- Bots have the same profile shape as real users: nickname + avatar (from the same galleries in
  `profile-and-identity.md`), an equipped tag, a stable-looking match history. A background job
  keeps a roster of `BOT_POOL_SIZE` (proposed, e.g. 30–50) personas with varied skill profiles
  (novice / casual / sharp — reuses the bot difficulty knob already prototyped in
  `prototype/index.html`'s `botMove()`).

## When a bot joins

- Bots are **always "available"** in the queue's eyes — the queue never permanently starves.
- To keep it convincing, injecting a bot is **not instant**: when a real player has waited
  `BOT_FALLBACK_SECONDS` (proposed default 20–40s, tune in Phase 0-A/4) without a human match,
  the matchmaker pairs them with a bot but adds a **randomized human-like delay** (a few more
  seconds, jittered) before the "opponent found" event fires — mirrors real matchmaking latency.
- Same mechanism covers 2v2 (fill remaining seats with bots) and a private table only if the host
  explicitly enables an "اضافه‌کردن حریف در صورت نیاز" option — never inject a bot into a private
  table uninvited.

## In-match behavior

- A bot plays through the **exact same server path** as a human: the server issues `submit` /
  `submit_guess` commands on its behalf into `applyCommand` (no special-cased "bot state") — this
  guarantees bots can't see anything a human client couldn't (no solution peeking).
  Reuses/extends the heuristic already built in `prototype/index.html`'s `botMove()`
  (weighted-random guesses biased toward the group it's likely found, imperfect on purpose).
- Chat: bots use **canned taunts only** (`chat-and-access.md`'s `canned_taunts` table), sent on
  the same jittered human-like delay as a real player's UI interaction would take. No free-text
  generation for bots at MVP — avoids needing an LLM in the realtime hot path and avoids the bot
  saying something off-brand. A generative/varied bot-chat upgrade is a later-phase idea, not MVP.
- Turn timing: bots don't always use the full timer — vary their response time within a
  plausible human range so a string of bot matches doesn't feel robotic.

## Mid-match takeover (D43)

Extends the above from "fills an empty queue/seat at match start" to "takes over an abandoned
*live* seat": if a human disconnects or goes AFK mid-match past a grace period, the server swaps a
bot into their seat rather than leaving the match to resolve via `matchmaking.md`'s abandonment
rules. Same non-disclosure rule applies — the remaining player(s) never see any "opponent left"
state. Owner: "وسط بازی اگه کسی لفت داد یا نتش مشکل پیدا کرد، بعد از یه مدت ربات جایگزینش بشه اما
معلوم نباشه ربات." The takeover grace period is `BOT_TAKEOVER_GRACE_SECONDS` (proposed 15s, D62 —
shorter than `RECONNECT_GRACE_SECONDS`'s 60s since the match is live and other players are
waiting), and the `bot_match_subsidy` accounting below needs to cover a mid-match handoff, not
just a match that started with a bot — that part is still open, see §Open follow-ups.

## Economy interaction — keeping it fair

This is the part that needs care, since real coins are at stake (`economy.md`):

- The human's entry fee is charged exactly as in a normal match (LedgerService, `match_entry`).
- The bot does **not** contribute a real entry fee (there's no second wallet to escrow from).
  Proposed: the match pot is topped up from the house side with a `bot_match_subsidy` ledger
  reason equal to what a human opponent's entry fee would have been, so payout math
  (`economy.md`'s win/draw/loss formulas) works unchanged and a player who beats a bot still
  gets a normal win payout. This is a new ledger `reason` value — add it to the enum in
  `data-model.md` §coin_ledger and to `economy.md`'s faucet table when this is implemented.
- Bot skill distribution must not be tuned to make humans lose more than they would against real
  opponents of similar experience — no thumb on the scale in the house's favor. Track win rate
  vs. bots as a metric once Phase 8 analytics exists, and alert if it drifts far from vs.-human
  win rates.

## Roster top-up (D153)

`bots.autofill_min` (admin setting, default 12, 0 = off): when bots are on and fewer active accounts exist, the driver's slow tick (every 30 s)
makes the missing number with levels 3–25, skill 30–75, win rate 40–65 %, think time 4–20 s, 25 % taunts and random cities. They are normal
bot accounts: the admin can pause, tune or add more, and the top-up never touches a roster that is already large enough.

## Open follow-ups

- Exact `BOT_FALLBACK_SECONDS` and `BOT_POOL_SIZE` are tuning knobs — set defaults in Phase 4,
  revisit with real queue-wait data after launch.
- **Mid-match takeover grace period** (D43) — `BOT_TAKEOVER_GRACE_SECONDS` proposed at 15s (D62), needs real queue/match telemetry to tune like `BOT_FALLBACK_SECONDS`.
- Whether/how a private-table host can opt into "fill with bot if a seat is empty" needs its own
  small UI decision when the private-table screen is built (see `docs/logic/matchmaking.md`
  §Private tables) — not yet specified.

## As built (D86): bot players made in the admin panel

- **Accounts.** A bot is an ordinary `users` row (`is_bot = true`, no device id so nobody can sign in as it) plus `bot_players` (skill 0–100, think-time range,
  chance to answer a taunt, active). The admin generates up to 50 at once («بازیکن‌های ربات»): distinct names (preset nicknames + common given names; the pool is
  finite), random avatar, gender, city, a level inside the asked range, XP/games/wins that fit that level (`plausibleStats`), coins, and the medals those stats earn.
  They can be tuned one by one or paused. `is_bot` is never selected by any player-facing endpoint or socket payload (tests check the payloads).
- **Queue.** Every 5 s the driver looks at the duel queue: a human who waited `bots.fallback_seconds` (8) plus a per-player random delay up to
  `bots.fallback_jitter_seconds` (4) is paired with an idle active bot; if the match cannot start the human goes back in line with the original wait.
  `bots.enabled` is the master switch.
- **Playing.** On its `match:state` snapshot the bot waits a human-like pause (its think range, never past the turn end) and submits four cards through the same
  `MatchService.submit` as any player. `chooseBotMove`: with probability about its skill (capped at 90 %) it submits a real group, else a "one away" or a guess;
  a duplicate set is re-chosen. **The answer reaches the driver through `solutionFor`, a server-internal call that the gateway never exposes — skill is how often it
  uses it** (the spec's "no peeking" holds for what a client can ever see). Win rate versus bots should be tracked once analytics exists.
- **Chat.** In a duel a bot greets, answers a human's taunt (its `taunt_percent`) and says «خداقوت» at the end, always with canned taunts. In a city room a bot from the same
  city answers a human's message with a canned line after 5–25 s, with probability `bots.city_reply_percent` (15 %).
- **Tournaments.** A tournament with «جای خالی با ربات پر شود» takes idle bots for empty seats when it starts (no fee); bots are never paid prize coins.
## Lobby tables (D213)

`apps/server/src/tables/ambient.ts` (`AmbientLobby`, ticked every 5 s next to the bot driver; off with `bots.enabled` or `feature.tables`) keeps two kinds of bot tables in the
«سفره‌خانه» list, each with a random Persian name, icon, rounds and price rounds:
- **Open** (`tables.ambient_open`, 5): bot-hosted public tables, 40 % 2v2 with 1–3 bots already seated, else a 1v1 with the bot host; a 1–5 min life, at most two new ones per tick.
  A person's seat request is answered by the bot host after 2–6 s (`TableService.answer`), which sets `fillAt` 3–8 s ahead; then idle bots take the empty seats (teams 2+2) and
  `TableService.start` runs the normal friendly match (`startMatch`/`startTeam`). A person who leaves before `fillAt` cancels it; too few idle bots just delays the start.
- **Playing** (`tables.ambient_playing`, 3): bots-only tables whose match really runs (bots play through the normal driver path), one new per tick at most, for people to **watch**.
Now and then (25 % per tick per running public table, at most 3 at once) a bot sits in the stands of any running table, real ones included, for 15–60 s, so the watcher count moves.
Both close when their match ends (a closed one shows in the recent list). Tables live in memory; the only rows written are those of a real match (bot stats, and the coins of a person at a paid table). Bot tables ask an **entry fee** (D215): at least
`tableMinEntry(rounds)`, +0…40 in steps of 10, capped at `AMBIENT_TABLE_FEE_MAX` (100). A bot seat pays nothing and never collects: `TableStakes` (given `isBot`) skips bots when taking
fees, refunding and paying out, and the pot is computed as if the bot had paid — the house funds that share (`bot_match_subsidy`, no ledger row of its own: it is simply the part of a
winner's payout no player paid in). Same as `duel/stakes.ts` does for queue duels. Adult track only.
- Not built: bots accepting friend requests, bots in human-made tables, mid-match takeover of an abandoned human seat (D43), coin escrow/subsidy for the queue (see above for tables) (match entry fees do not
  exist yet), bot-chat beyond canned taunts.

## Skill by level

A bot's strength follows its **level** (from its `user_stats.xp` via the default XP curve), in the same five bands as the puzzle tiers
(`DEFAULT_PUZZLE_TIERS`: 1-3, 4-8, 9-15, 16-25, 26+). Pure function `botSkillForLevel(level, skill)` in `packages/shared/src/bots/skill.ts`; every number is in
`packages/shared/src/config/botSkill.ts` (`BOT_SKILL_BANDS` etc.). Level is not a new field: the admin generator already gives each bot XP that fits a level
(`plausibleStats`), and persona levels are chosen in the asked range, so pick the range near the humans' levels (autofill uses 3-25) to keep opponents comparable.

| level | real-group chance | one-away share of misses | think time × | price error ≤ |
|---|---|---|---|---|
| 1-3 | 25 % | 30 % | 1.8 | 70 % |
| 4-8 | 40 % | 35 % | 1.5 | 55 % |
| 9-15 | 55 % | 35 % | 1.2 | 40 % |
| 16-25 | 70 % | 30 % | 1.0 | 28 % |
| 26+ | 84 % | 25 % | 0.8 | 15 % |

- The per-bot admin `skill` (0-100, neutral 50) nudges accuracy by 0.25 points per point off neutral (clamped 8-90 %) and the price error by -0.2 % per point (floor 5 %).
- Think time: the bot's own range is multiplied by the band factor (still capped so it never misses its turn). Low levels are slower, make more wrong picks and wild price guesses.
- Determinism: all randomness comes from the driver's injected RNG. Bots still play only through `MatchService.submit` / `submitPrice`; the level changes how often the
  server-side driver uses the answer (`solutionFor` / `priceAnswerFor`), never what a client can see.
- Level uses the default curve (an admin level table with custom `starts` is not read by the driver).

## Who a bot is paired with (level match)

A waiting human is given an idle bot within `BOT_MATCH_LEVEL_GAP` (2) levels of their own, picked at random among those; when none is that near, among the nearest ones. A 2v2 fill matches the average level of the waiting humans. If the level lookup fails the driver falls back to a random idle bot (a player is never left waiting). The auto-generated roster covers levels 1–30 so a near bot exists for everyone. Code: `pickBotByLevel` (`packages/shared/src/bots/pick.ts`), `BotDriver.botNear`.
