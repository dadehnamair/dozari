# Owner backlog of 2026-10-01 (27 items) — order, defaults, status

Source: the owner's list after PR #49. Each item gets a proposed default (tunable from the admin panel, never a
code literal — CLAUDE.md rule 9) and ships in a small PR. Product questions stay open in `DECISIONS.md`.

## Order of work

| Phase | Items | What | Needs first |
|---|---|---|---|
| **A. Player record** | 24, 8, 7, 14 | `user_stats` (games/wins/losses), XP + level + skill estimate, city, optional e-mail, nickname rules (max length, no digits, no Latin/Persian letters per setting), warnings/commendations/badges/medals tables | — |
| **B. Coin economy** | 4, 1, 3, 2, 5 | coins are precious: sink/faucet audit, shop catalog (coin prices, min level, limits), solo-game hints, coin packages (real money built-but-off), referral code as "gold", gifts and loans between friends with weekly cap | A (level) |
| **C. Contact & friends** | 6, 7, 19, 20, 22 | phone number → Bale contact verification + SMS fallback, search by id/phone, contact import, invite links through a configurable shortener, phone/id sharing only for players with a badge | A, B (badges) |
| **D. Chat & moderation** | 16, 17, 18, 21, 23 | chat service with canned taunts (admin categories), shared private tables in chat, city-mates room, "Agent Dozari" badge holders: timed mute and warnings | A (badges, level) |
| **E. Content control** | 15, 25, 26, 27 | daily puzzle by day conditions/trends, many admin-defined bot users that look like players (level, items, short chat replies), tournament entry by coins and level, tournament builder + own page | A, B |
| **F. Feel** | 9, 10, 11, 12, 13 | city dialect phrases, sound effects, city background elements (owner supplies assets), extra personal settings, "touch everything" polish | A (city) |

Items already covered by earlier PRs: 19 (search) partly, 20 none, 23 admin side partly (ban/notes). Everything else is new.

## Proposed defaults (all tunable, to be confirmed by the owner)

- **Level**: XP per finished game 10 (+20 on a win, +10 on solving all 4 groups); level n needs `50·n·(n+1)/2`-style growth,
  curve in `config/progression.ts`, cap 50. Skill tier (D34) is derived from the last 20 games, not from level.
- **Hints (solo only)**: "reveal one group's category" 25 coins, "remove one wrong card" 15 coins, "show a hint about the
  price" 10 coins; max 2 per game, price doubles for the second; unlocked from level 2; every number editable.
- **Shop**: items bought with coins only; real-money packages exist as a table but stay disabled until the owner decides
  (D18/open question 4). Paid cosmetics unlock at a level set per item.
- **Referral code ("gold")**: one code per player, issued at level 3; inviter gets the reward only after the invitee has
  3 finished matches; redeeming gives the free-chat unlock plus a smaller coin bonus; abuse caps in economy.md.
- **Gifts / loans**: friends for at least 7 days, level 5+; weekly cap 200 coins sent; a loan must be accepted by the
  receiver, due in 7 days, auto-recovered from future winnings; the game shows the rules before the first use.
- **Phone**: collected only to link Bale/SMS and find friends; never shown to others unless the owner of the number has
  the "contact-sharer" badge and chooses to; e-mail is optional and never required.
- **Nickname rules**: max 20 characters by default, digits and Latin letters refused by default, each switchable.
- **Tournament entry**: coins and/or minimum level, both optional (0 = free / any level).

## Status

Ticked in `docs/PLAN.md` §Owner backlog as each PR merges.
