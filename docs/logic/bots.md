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
- **Queue.** Every 5 s the driver looks at the duel queue: a human who waited `bots.fallback_seconds` (25) plus a per-player random delay up to
  `bots.fallback_jitter_seconds` (15) is paired with an idle active bot; if the match cannot start the human goes back in line with the original wait.
  `bots.enabled` is the master switch.
- **Playing.** On its `match:state` snapshot the bot waits a human-like pause (its think range, never past the turn end) and submits four cards through the same
  `MatchService.submit` as any player. `chooseBotMove`: with probability about its skill (capped at 90 %) it submits a real group, else a "one away" or a guess;
  a duplicate set is re-chosen. **The answer reaches the driver through `solutionFor`, a server-internal call that the gateway never exposes — skill is how often it
  uses it** (the spec's "no peeking" holds for what a client can ever see). Win rate versus bots should be tracked once analytics exists.
- **Chat.** In a duel a bot greets, answers a human's taunt (its `taunt_percent`) and says «خداقوت» at the end, always with canned taunts. In a city room a bot from the same
  city answers a human's message with a canned line after 5–25 s, with probability `bots.city_reply_percent` (15 %).
- **Tournaments.** A tournament with «جای خالی با ربات پر شود» takes idle bots for empty seats when it starts (no fee); bots are never paid prize coins.
- Not built: bots accepting friend requests, bots in 2v2/private tables, mid-match takeover of an abandoned human seat (D43), coin escrow/subsidy (match entry fees do not
  exist yet), bot-chat beyond canned taunts.
