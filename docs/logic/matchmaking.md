# Matchmaking, rooms & connection handling

No rating/ELO at launch (D12). Values in `config/game.ts`.

## Queues (in-memory for MVP, Redis later)

- `duel` queue: FIFO of `{userId, joinedAt}`. Pair the two oldest compatible entries.
- `team` queue: entries are **parties** of 1 or 2. Form a match from parties totalling 4 players, filling
  sides so parties stay together (2+2, 2+1+1, 1+1+1+1).
- Compatibility: both can afford the entry fee (checked at join AND re-checked at match start), not
  mutually blocked, not in another active match.
- *QUEUE_BOT_FALLBACK_SECONDS* = 60 (superseded default — see `docs/logic/bots.md` for the
  actual `BOT_FALLBACK_SECONDS`, proposed 20–40s): once a real player has waited this long with
  no human match, an **undisclosed AI opponent ("bot")** fills the match instead (D23, owner
  request 2026-09-27). The waiting screen still offers "play solo while waiting" alongside this.

## Match start sequence

1. Queue pops players → create `matches` row (`waiting`) and socket room `match:<id>`.
2. Pick puzzle unseen by all participants (puzzle-generation.md §Infinite).
3. **Escrow entry fees** via LedgerService (one transaction; idempotency key per user). If any fails →
   abort, refund others, requeue the rest at their original position.
4. Send `match:found` → clients show opponent(s) → *READY_TIMEOUT* = 10 s for `match:ready`.
   Missing ready → abort + refund, the no-show gets a short queue cooldown (*NO_SHOW_COOLDOWN* = 60 s).
5. `active`: first turn goes to a random side (seeded; stored in match_events).

## Private tables (میز اختصاصی)

- Host creates: `{format: '1v1'|'2v2', entryFee}` → 5-char room code (alphabet without 0/O/1/I/L),
  expires after *ROOM_IDLE_MINUTES* = 15 without start.
- Deep link `gheymat://room/<CODE>` and web URL `https://<domain>/r/<CODE>`.
- Joiners pick a side; host can swap/kick; host starts when seats are full. Entry fee escrowed at start.
- Rematch keeps the same room.

## Reconnects & abandonment

- Server keeps the match authoritative; a disconnect does not pause the clock.
- *RECONNECT_GRACE_SECONDS* = 60: a returning client sends `match:resume {matchId}` and receives a full
  redacted snapshot.
- Missing the grace window, or explicit leave → that player is `abandon`.
  - Duel: opponent wins.
  - Team: if one teammate remains, team continues (captaincy passes). Both gone → other side wins.
- Abandoners get no payout and their entry fee goes to the pot (sink); repeated abandons → queue cooldown.

## Socket events (contract lives in `packages/shared/src/socket/events.ts`)

Client → server (all with ack `{ok:true,...}|{ok:false,error}`):
`queue:join {mode, partyId?}`, `queue:leave`, `party:create`, `party:join {code}`,
`room:create {format, entryFee}`, `room:join {code}`, `room:seat {side}`, `room:start`,
`match:ready`, `match:submit {itemIds}`, `match:propose {itemIds}`, `match:resume {matchId}`,
`match:leave`, `match:rematch`, `chat:send {channel, tauntId?|text?}`.

Server → client:
`queue:status {position, waitedSec}`, `match:found {matchId, players}`, `match:state <ClientView>`
(full redacted snapshot, sent on every change — boards are tiny, no diffing needed),
`match:event <MatchEvent>` (for animations: guess result, turn change), `match:ended {result, payout, solution, chart}`,
`chat:message`, `error`.

Auth: JWT in the socket handshake `auth.token`. One active socket per user; a new connection
replaces the old one.
