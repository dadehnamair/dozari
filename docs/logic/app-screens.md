# App screens — UI-level decisions from the owner interview

This file captures screen-by-screen UI decisions from the 2026-09-27 owner interview that don't
belong in a game-logic spec (those are `price-guess-round.md`, `profile-and-identity.md`,
`bots.md`, and the existing `matchmaking.md`/`game-rules.md`/`chat-and-access.md`). Treat this as
part of the same "logic specs" set in `CLAUDE.md` — read it before building the matching screen.

## Onboarding (first app open, before any account setup)

1. **4-slide tutorial**, skippable both by swipe-dismiss and an explicit "رد شدن" button. Slides:
   1. Goal of the game + a worked example of solving one group in the Connections puzzle.
   2. The 4-mistake rule: what happens when you run out (game over / turn passes).
   3. The price-guess bonus round (`price-guess-round.md`) — what it is, that it happens after
      every puzzle.
   4. Coins/economy: entering and playing is free; tables/matches can cost coins.
2. After the tutorial, a **random nickname + avatar** is assigned silently (no signup screen) —
   see `profile-and-identity.md`. The user lands straight on Home.

## Home / Lobby screen

Everything in one row of equal-weight cards, plus the utility elements below (owner: "همشون" /
"همه با هم در یک ردیف کارت، وزن یکسان" — no mode is visually demoted, price-guess is not a
separate card since it's folded into every mode per D19):

- Mode cards, one row, equal size: **تمرین تکی** (solo/practice), **۱ در برابر ۱**, **۲ در برابر
  ۲**, **میز اختصاصی** (private table).
- Coin balance (header, tappable → profile/wallet).
- A **separate card for UGC** ("پیشنهاد یک قیمت" / "رأی بده") — its own card, not nested inside
  another menu (owner decision, 2026-09-27; also reflected in `PLAN.md` Phase 7).
- Daily challenge / streak banner.
- Achievements shortcut.

## Matchmaking queue (waiting) screen

Shown between tapping a competitive mode and the match actually starting:

- Estimated wait time + a visible **cancel** button.
- **"Practice solo while you wait"** option, running on the same screen/timer — doesn't lose the
  queue slot (see `matchmaking.md`; this is also the moment a bot silently fills in per `bots.md`
  once the wait threshold passes — the UI never distinguishes that case).
- Short info about the puzzle that's queued: number of groups (always 4) and a difficulty hint —
  enough to set expectations, not enough to spoil anything.

## Private table — host controls

Only available **before** the match starts; once everyone is seated and the host hits start, the
host loses seat-control (owner: "بعد از شروع میزبان کنترل صندلی نداره" — keeps mid-match behavior
identical between private and queued matches, per the redaction/authority model in
`ARCHITECTURE.md`):

- Change format (1v1 / 2v2) and entry fee, any time before start.
- Move/kick guests between seats.
- Lock the table (blocks further joins) and extend it if it's about to expire
  (`ROOM_IDLE_MINUTES` in `matchmaking.md`).

## In-match chat drawer

- A **floating icon button** in a corner of the match screen (not an always-visible panel) —
  opens the chat drawer on tap; a **red badge** shows when there's an unread message. Keeps the
  puzzle board uncluttered, which matters more here than a persistently visible chat.
- Drawer contents (taunts, free-text gating, team/all channels) unchanged — see `chat-and-access.md`.

## Settings screen

- Sound and vibration toggles (independent on/off switches).
- Delete account / log out.
- "Replay tutorial" — re-opens the 4-slide onboarding flow from Settings, for a returning user
  who wants a refresher.
- About us / support / contact support (static content + a contact channel — exact channel
  (Telegram, email, in-app form) is a content/ops decision, not logic; track as a small open
  item, not blocking).

## Wallet / coin history

**No separate wallet screen** (owner decision, 2026-09-27): the Profile screen's match-history
list (`profile-and-identity.md`) is the coin history — each row already shows coins won/lost per
match. No dedicated full-ledger view (all faucets/sinks) at MVP; revisit only if players ask for
non-match coin movements (daily bonus, invite rewards) to be individually visible.

## Open follow-ups

- Achievement/tag catalog content (which badges exist, unlock rules) is content work, not logic —
  tracked as a Phase 6/7 content task in `PLAN.md`, not a screen-design question.
- UGC voting-feed screen is now specified in `docs/logic/ugc.md` §Voting feed UI (single-card
  swipe, approve/reject) — no longer open.
