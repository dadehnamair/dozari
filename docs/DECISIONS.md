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
| D3 | Custom Node.js + Socket.io + Postgres backend instead of self-hosted Supabase | proposed | Brief allowed both. Custom backend keeps game logic in one TS codebase, fewer moving parts to self-host (Supabase = ~10 containers), realtime match logic needs a custom authoritative server anyway. Revisit if admin/CRUD needs explode. |
| D4 | Drizzle ORM | proposed | Pure TS, no engine binary download (Prisma engines download can fail from Iran). |
| D5 | Prices stored as integer **rials** (`BIGINT`), displayed as toman | proposed | Brief says "toman, nominal". Rial integers avoid fractional toman for very old prices (e.g. 5 rials = 0.5 toman) and are unambiguous across the new-toman redenomination. Display layer converts. Nominality is unchanged. |
| D6 | Years stored as Solar Hijri integers | proposed | Content & players think in شمسی ("سال ۷۵"). |
| D7 | Guest accounts first, phone OTP optional | proposed | Brief: entry must be completely free/frictionless. |
| D8 | **Shared board, alternating turns** for competitive matches | proposed | Brief says gameplay is turn-based/slow; a shared board makes it a real head-to-head (steal groups from the opponent) and gives 2v2 teams something to coordinate on. Alternative (parallel race on separate boards) documented in `logic/game-rules.md` §Alternatives. |
| D9 | Coin amounts per `logic/economy.md` defaults | proposed | Brief left formula open (open question 1). All values in `packages/shared/src/config/economy.ts`. |
| D10 | Free chat gated by *redeemed* invite code; canned taunts for everyone | accepted | Brief. Visibility details in `logic/chat-and-access.md` are **proposed**. |
| D11 | Group titles are witty/indirect; hidden rule is objective and machine-checkable | proposed | Title = flavor (brief), rule = what validator checks. Keeps "infinite puzzles" solvable & fair. |
| D12 | No ELO at start; FIFO queue with widening wait | accepted | Brief. |

## Open questions (from the brief + new)

1. **Exact scoring / coin formula** — defaults proposed (D9). Needs playtesting.
2. **Sources for historical prices** — deferred. Schema already has `source_type`, `source_url`, `source_note`, `confidence`.
3. **Team chat vs cross-team chat visibility** — proposed in `logic/chat-and-access.md`.
4. **Long-term monetization** (ads / subscription / coin packs) — open. Iranian IAP = Cafe Bazaar / Myket billing SDKs; Iranian ad networks (Tapsell, Adivery). Don't build until decided.
5. **Final game name** — open. Working title everywhere: `gheymat` (code), «قیمتش چند بود؟» (UI).
6. **Turn model (D8)** confirmed? shared-board-alternating vs parallel race.
7. **Min content for launch** — proposed: ≥ 300 products with ≥ 3 price points each, ≥ 200 validated puzzles pre-generated.
8. **Moderation capacity for UGC & free chat** — who reviews? Proposed: admin panel + community votes threshold.
