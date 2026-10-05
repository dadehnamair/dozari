# Age tracks (رده‌ی سنی) — kid / teen / adult

Status: **proposed**, nothing built yet (D198). Owner request 2026-10-05: one game for every age; kids get an educational space; a parent
can hold the adult account and add the child; the admin panel can filter and manage everything by age band.

## Principles

1. **One brand, one app, three tracks (owner, 2026-10-05).** Only the *logic* changes per track. Name, logo, icon, palette, fonts, voice, home
   shell, store listing and splash stay the one «دوزاری» brand (`brand.md`, `brand-visual.md`); there is no second app, theme or icon. «دوزاری
   کوچولو» appears **only as the label of the kid track inside the app** (the title of the kid home and of its mode card), nowhere else. The
   adult track stays the full price-nostalgia game and never shows kid content. Wording: «بازی برای هر سن».
2. **The track is chosen, never computed from a birth date.** We store a coarse track chosen by the user (kid / teen / adult); no ID, no school. The optional
   birth date of D160 (minimum age 10) stays as it is and is **independent**: it never picks or changes a track and no rule reads it. A kid profile
   created through a guardian has no birth date field (under the D160 minimum), so the birthday week simply does not apply to it. In code the word is
   **track** (`AgeTrack`, `age_track`, `trackRules`); `AGE_BANDS` in `shared/calendar/birthday.ts` is the unrelated admin age histogram.
3. **Everything is band-aware.** Players, puzzles, items, lessons, matchmaking, chat, tournaments, leaderboards, rewards, settings and admin
   views all carry or derive a band, so each can be listed, filtered and switched off per band.
4. **Safe by design, not by locks (owner, 2026-10-05).** Restrictions must not bore kids. The hard walls (no strangers outside the track, no wagers,
   no purchases, no personal data in chat, filtered text) are built into the track rules and are **invisible**: a feature a track does not have is simply
   not drawn (no padlocks, no «ask your parent» walls, no nag pop-ups). Everything a kid can safely do is **on by default**; the guardian can only
   tighten, from the profile (§Guardian panel), never because the app was timid.
5. All numbers (band edges, which feature each band gets) live in `packages/shared/src/config/ageTracks.ts` (non-negotiable rule 9).
   UI strings in `apps/mobile/src/i18n/fa.ts`; lesson text and kid group titles are DB content.

## Bands

| band | id | age | game | proposed edges |
|---|---|---|---|---|
| Kid | `kid` | up to 11 | learning space: easy picture puzzles from things kids know (food, school, toys, fruit), then a word lesson | `AGE_BAND_EDGES = { kidMax: 11, teenMax: 17 }` |
| Teen | `teen` | 12–17 | the real game, easier tiers first, price rounds without coin wagers | |
| Adult | `adult` | 18+ | the full game as today | |

The edges are config. A user's band is **chosen**, not computed, so the edges only label the choice («تا ۱۱ سال»).

## First-run flow

After the login step of D147 (and before the tutorial) one new screen: «چه کسی بازی می‌کنه؟» with three big cards (کودک / نوجوان / بزرگسال).
It is shown once, stored on the account, and reachable later from settings.

- **Adult:** continues as today. No kid content anywhere.
- **Kid or teen:** the app says «برای کودکان فضای آموزشی ویژه داریم» and asks for a **guardian's phone number** (OTP, same code path as
  `profile-and-identity.md` §Phone login). When the guardian verifies, the child profile is created and linked.
  - If the guardian has no account yet, one is created from that number (adult band, phone verified).
  - A kid/teen **plays at once**, solo, against kid bots and in the same-track quick match, with no wait. The guardian link is needed only for the
    **social features** (friends, friend duels, private tables, chat) and is asked for once, at the moment the child first taps «دوستان» or «میز»,
    as a friendly one-step screen (the guardian's phone, one code). It is never repeated once linked.
- **Guardian side:** one phone number = one adult account holding **many child profiles** («افزودن فرزند»). Each child profile has its own
  nickname, avatar, band and progress; the guardian switches between them. A child profile has no phone of its own.
  A child on another device joins with a short **link code** the guardian shows (6 digits, 10 minutes, one use).
- Self-declared bands can be false. Mitigation is structural, not policing: kid/teen rules are restrictive, and **moving a profile to an older
  band needs the guardian** (a kid cannot promote themselves to teen or adult). Moving to a younger band is free for anyone (an adult can try
  the kid space through «حالت پیش‌نمایش», see below).

## What each band gets

| area | kid | teen | adult |
|---|---|---|---|
| Puzzle content | kid pool only (`age_track = kid`) | teen pool + easy adult groups | adult pool (+ teen pool as an option in settings) |
| Price-guess round | **off** (replaced by the word lesson) | on, **no coin wager** | on, with the D24 wager |
| After a puzzle | **word lesson** (letters, word, picture, short story) | normal result chart; lesson optional | result chart |
| Chat | **managed chat** (§Friends, duels and chat): kid-safe taunts and emoji with everyone in the match, free text only with accepted friends of the same track once the guardian has switched it on | same as kid, free text on by default once linked | free text with a redeemed invite code (rule 7), as today |
| Canned taunts | kid-safe set | teen set | full set |
| Matchmaking | same track only; bots of the same track | same track only | adult only |
| Friends | only within the same track (plus the guardian) | same | all adults |
| Friend duels and private tables (1v1, 2v2) | **yes**, with friends of the same track (and the guardian) | **yes**, same | all adults; may also host a family table with their child |
| Coin wagers, wheel prizes with coins/gems | no wagers; wheel allowed, prizes kid-safe | no wagers | as today |
| Real-money purchases | none | none | per `economy.md` (when enabled) |
| UGC (suggest items) | no | no | yes |
| City / province on public profile | hidden | hidden | as today |
| Leaderboards & tournaments | own track only (kid tournaments are their own, low-stakes, star prizes) | own track only | adult |
| Public profile sheet (D67) | nickname + avatar + level only | nickname + avatar + level + stats | as today |
| Invite codes | can redeem (a reward for the guardian), cannot share outward | same as kid | as today |

Everything above is a **row in the band config** (`ageTracks.ts`), not scattered `if (band === 'kid')` checks: one pure function
`trackRules(band)` returns the feature set, and the server calls it on every guarded action. The client only reads the result from
`GET /config` and `GET /me`.

## Kid word lesson («کلمه‌آموزی»)

After a kid puzzle ends, each of the four groups opens a card (swipe through, skippable):

1. The picture and the word, big (`item.word_fa`).
2. **Letters:** the word split into letters, each shown separately and joined, with the count («۳ حرف: ن ـ ا ـ ن»).
3. A one-line story or fact (DB text, e.g. what it is, who eats it) and an optional syllable split.
4. Optional audio later (bundled files, no cloud TTS — rule 8).

Pure function `splitWordLetters(word)` in shared (handles ZWNJ, joining forms, ignores diacritics except as a mark on its letter; unit tests with
real words). Lesson text is **hand-written and reviewed**; a kid lesson cannot be published without an editor's approval (admin queue below).

Kid scoring is gentle: stars instead of price error, no loss screen with a coin number, a retry is always offered.
Kid difficulty comes from `progression.md` skill tiers, but on its own ladder (a kid ladder runs over kid puzzles only).

## Friends, duels and chat

Kids and teens get the same social loop as adults, **inside their own track**:

- **Friends** are track-bound. A kid adds a friend by friend code or a share link; the other side accepts. A kid never sees, finds or messages anyone
  from another track (public profile search, leaderboards and the city tools are filtered by track on the server).
- **Friend duels and private tables** (1v1, and 2v2 with friends) work as for adults (`matchmaking.md`, D142/D143), with the room limited to one
  track. The only cross-track room is the **family table** (guardian + their own children).
- **Managed chat** keeps the fun and removes the risk:
  1. Everyone in a match can use the **taunt/emoji/sticker library** of the track (large, funny, kid-safe; DB content).
  2. **Free text** is allowed only between accepted friends of the same track, only after the guardian's switch «فعال‌سازی گفتگو» (default on at link
     time, one tap to turn off). That switch counts as the redemption for rule 7 (it sets `users.chat_unlocked_at` for the child), so the chat gate in
     `chat-and-access.md` is unchanged in shape.
  3. Text goes through the existing word filter plus a **stricter track list** (kid/teen lists in the admin word filter), and it blocks phone numbers,
     links, handles and addresses. A blocked message is dropped with a friendly line, never a scolding.
  4. Rate limit, one-tap **report** and **mute**, and a separate admin review queue for reports and filter hits of kid/teen chats (§Admin panel).
     Chat is stored for the same period as other chats, so a report can be checked.
- Friend requests between two kids are **auto-accepted on acceptance by the other child**; the guardian gets a quiet notice in the digest and can
  switch to «ask me first» (§Guardian panel).

## Guardian panel (in the profile)

Reached from the guardian's own profile: «فرزندان من» → a child. Short, one screen per child, plain switches, no jargon. Defaults are the open choice;
each switch only **narrows**:

| switch | default | options |
|---|---|---|
| Chat | friends, free text | friends only with free text / phrases and emoji only / off |
| New friends | auto, I am told | auto and tell me / ask me first |
| Friend duels and tables | on | on / off |
| Quiet hours | none | optional time window; outside it the child sees a soft «وقت استراحته» card, **dismissible for 10 minutes**, never a lock-out |
| Daily play reminder | off | a gentle «امروز زیاد بازی کردی» after N minutes, config |

Plus: the child's digest (words learned, streak, who they played), block/unblock a friend, the link code, move the child to another track, remove the
profile, and the guardian's own switch to see what the child sees (**preview**). Nothing here costs money, and the guardian cannot read free-text chat
unless a report is filed (privacy of the child's talk with friends; the report flow shows the reported lines only).

**Anti-boredom rules for every restriction:** the child never sees a refusal for something the track never offered; a switched-off feature disappears
instead of showing a lock; any block message is one friendly line with a way forward; no feature is withheld pending the guardian beyond the one link
step for social features.

## Data model (to add to `data-model.md` when built)

- `users.age_track` ENUM(`kid`,`teen`,`adult`) NOT NULL DEFAULT `adult` (existing users stay adult), `users.age_track_set_at` DATETIME(3) NULL
  (NULL = not asked yet, so the chooser shows once).
- `guardian_links(guardian_id, child_id, created_at, revoked_at)`; a child has at most one active guardian; the guardian is an adult with a
  verified phone. A guardian can revoke (the child profile is kept, locked to the safest rules, and shown «ورود با شماره‌ی ولی»).
- `puzzles.age_track` and `items.age_track` (the lowest band the content is meant for) plus `puzzles.audience` rule via config: which bands may be served.
  `validatePuzzle` gains a check that a kid puzzle uses only kid items (rule 5 still holds).
- `item_lessons(item_id, word_fa, story_fa, syllables_fa NULL, status, reviewed_by, reviewed_at)`; letters are computed, not stored (no JSON, D63).
- `canned_taunts.age_track` and the word filter keep working as today; kid text never goes through free text, so the filter does not need a kid mode.
- Match rows record `age_track` so history, stats and the admin can split by band.
- `guardian_settings(child_id, chat_mode, friend_approval, duels_enabled, quiet_from, quiet_to, reminder_minutes)` — plain columns, no JSON (D63);
  defaults as in §Guardian panel. `friendships` rows are only allowed between users of the same `age_track` (checked on write and on read).
- `word_filter` lists gain a `track` column (`all` / `kid_teen`) so the stricter list applies only to those tracks.

## Server rules

- Every endpoint that can reach another player or serve content calls `trackRules(user.age_track)` and refuses (`403 {error:"age_track"}`) what the band does not
  allow; every matchmaking queue entry **carries its track** and `DuelQueue.takePair/takeGroup` only ever pair or group entries of one track, so a kid can never be paired with an adult by a bug in one filter.
- Bots in a band (`bots.md`) get the same band and a band-appropriate nickname list.
- `GET /me/age-track` and `PUT /me/age-track {track}` (own track; the first pick is free, later the same or a younger track is free, an older one needs the guardian's confirmation through the guardian's session, answered `403 needs_guardian` until phase 2).
- `POST /guardian/children`, `POST /guardian/link-code`, `POST /guardian/children/:id/track|revoke`, `GET /guardian/children` (guardian-only).
- Coins stay in `coin_ledger` only; a guardian cannot move coins to a child outside the existing gift path (D-wallet rules unchanged).

## Admin panel

A new section **«رده‌های سنی»** (and an **age-band filter chip on every existing list**: users, puzzles, items, lessons, tournaments, reports,
bots, message center audience, coin ledger, matches):

- Overview per band: players, daily actives, matches, completion rate, average stars/accuracy, reports.
- Band config editor: edges, per-band feature switches (a kid-safe kill switch for any feature), shown through `GET /config`.
- Content: kid/teen puzzle and item browsers with the lesson editor and a **review queue** (draft → approved) for kid content; counts of puzzles per
  band and tier so gaps are visible.
- Guardians: list, their children, link/revoke, support actions (re-link, move band).
- Moderation: reports and filter hits from kid/teen chats go to a separate queue (reported lines only); the stricter word list is edited here; ban/log-out tools as in D74.
- Message center (D73): audience can be limited to a band; adult marketing text never goes to kid/teen profiles.
- Audit log records every band change and guardian action.

## Adult experience (guardrails)

- The chooser's adult card is first and wears the main brand voice; kid art, stars and the word lesson never appear in an adult account.
- Store listing, splash, icon and home shell are the one «دوزاری» brand; «دوزاری کوچولو» is only a track label inside the app (principle 1).
- **Preview mode** («پیش‌نمایش کودک») lets a guardian open the kid space read-only (no progress, no coins) to judge it.

## As built (phase 1, behind a switch)

Setting `feature.age_tracks` (admin → settings → app, **default off**): off means everybody plays the adult game, no chooser shows and `PUT /me/age-track` answers 503.
- shared: `config/ageTracks.ts` (tracks, edges, chat modes), `agetrack/rules.ts` (`trackRules`, `canSelfSwitchTrack`, `canMeet`, `parseAgeTrack`), `agetrack/contract.ts` (zod).
- db: migration 0058, `users.age_track` + `age_track_set_at`, `puzzles.age_track`, `products.age_track` (all default `adult`).
- server: `apps/server/src/agetrack/` (service, DB store, `GET/PUT /me/age-track`); `DuelQueue` entries carry the track and pair only within one; the gateway reads it through `trackOf`; the admin user list filters by track (`/admin/users?track=`) and rows carry `ageTrack`.
- app: `src/agetrack/` — the chooser screen (shown once after login, before the tutorial, only when the switch is on and the account was never asked; a failed lookup never blocks play).
- Phase 3 (kid content pipeline, same switch):
  - shared: `lesson/letters.ts` (`splitWordLetters`, `letterForms`, joins), `lesson/contract.ts` (`POST /lessons` card schema), `validatePuzzle` check `track.item_too_old` (an item may only be in puzzles of its own or an older track; items without a track read as adult).
  - db: migration 0059, table `item_lessons` (word, story, syllables, `draft`/`approved`, reviewer).
  - server: puzzles are picked **by track pool** (`PuzzleSource.pickRandom({tracks})`, default adult only, so kid content never leaks) in solo, offline packs and live/2v2 matches (the first player's track; queues pair one track). `POST /lessons` returns approved cards; `/admin/lessons` (list kid items with their lesson, save as draft, approve/unapprove); admin product edit and create carry `ageTrack`; the hand-built puzzle builder has a track select and the picker hides items that are too old (`item_track` is refused by the server).
  - admin: tab «کلمه‌آموزی کودک» under «بازی و پازل».
  - app: `LessonPanel` (word, letters one by one, count, story) replaces the price round and chart for a player whose track rules have `wordLesson`; `useTrackRules` reads the rules once per run.
- Phase 2 (guardian link, same switch; the `/guardian`, `/me/guardian` and `/lessons` paths answer 503 `feature_off` while it is off):
  - db: migration 0060, `guardian_links(child_id PK, guardian_id, created_at)` (one guardian per child; **removing a link deletes the row**, the child profile stays) and `guardian_link_codes(code, child_id, guardian_id, expires_at)` (6 digits, 10 minutes, one use, one live code per child).
  - server: `apps/server/src/guardian/` — child side `GET /me/guardian`, `POST /guardian/request {phone}` (SMS code to the guardian's number, via `PhoneLoginService`) and `POST /guardian/confirm {phone, code}` (`PhoneLoginService.prove` checks the code without touching an account; the guardian account is the number's holder, or a new adult account with that number verified); guardian side `GET/POST /guardian/children`, `POST /guardian/children/:id/link-code`, `PUT /guardian/children/:id/track` (the guardian's say that lets a child move up or down), `DELETE /guardian/children/:id`; and `POST /auth/child-link {code, deviceId}` signs a child's device in (10 tries per 10 minutes per address). A guardian must be an adult with a verified number and holds at most `GUARDIAN_MAX_CHILDREN` (6) children; a number held by a kid or teen account cannot be a guardian.
  - app: the guardian step right after a kid or teen picks a track (`GuardianStep`: number, code; «بعداً» always skips, it never gates play); settings rows «فرزندان من» (`ChildrenSheet`: list, add kid/teen, sign-in code, move track, remove) and «ورود با کد والدین» (`ChildCodeSheet`, also on the first-run login screen); shown only when the switch is on.
  - Still open: enforcing «social features need a guardian» (phase 4 with the social rules), guardian settings (phase 5).
- Starter content (draft, for the owner to review): `packages/db/seed/products/kid-starter.json` (48 kid items with icon and lesson text) and `seed/puzzles/kid-starter.json` (3 kid puzzles). The product seed accepts `age_track` and `lesson` (kid items need no price); lessons are inserted as **drafts** and never overwritten by a re-seed; kid puzzles are seeded as **drafts** (`status`), so nothing reaches players until an editor approves the lessons («کلمه‌آموزی کودک») and the puzzles («ساخت پازل»). Load it on an existing database with `pnpm --filter @dozari/db seed` (not `--if-empty`, which skips a non-empty catalogue).
- Phase 1 leftovers closed:
  - **Home hides what needs adult content or price knowledge**: `trackRules` gained `dailyPuzzle`, `priceOnly` and `lookup` (kid: all off; teen: price-only and lookup on, daily off; adult: all on), and the app drops those entries for a kid/teen track. The daily puzzle returns for a track once it has its own pool.
  - **Queue diagnosis is per track**: a waiting player's pool is checked (`diagnose(waitedSec, track)`), so an empty kid pool says «no puzzles» instead of hiding behind adult ones.
  - **Bots are track-neutral by design**: a bot fills any track's queue; the match's puzzle pool follows the human (`MatchService` picks by the first player, humans are always first), so no per-track bot roster is needed. A kid-friendly bot nickname list can come with the content.
  - **Admin «رده‌های سنی» tab** (under «بازیکنان و نظارت»): players per track, puzzles per track by status, kid lesson counts, linked children (`GET /admin/age-tracks`). The user list filters by track; the product editor and puzzle builder carry the track.
- Phase 4 (social for kids and teens), slice 1, **track-bound friends** (same switch): one gate `AgeTrackService.meetable(me, ids)` (server) is applied by `SocialService.sameTrack` and `FindService`
  (ctor param). Another track's player reads as *unknown*: `GET /players/:id` and `POST /friends/:id/request` answer 404, `accept` fails, search by ID/phone, contacts and invite links find nobody, and `GET /friends`
  and the leaderboards drop them (a friendship stored before one side moved track stays in the table but is hidden and unusable). Leaderboards are filtered after ranking, so a kid/teen board can be shorter than
  `LEADERBOARD_SIZE`, and `me.rank` is the place on the filtered list when the player is on it (otherwise the unfiltered rank: **open**, needs a per-track rank query). With the switch off everybody is adult, so nothing changes.
- Phase 4, slice 2, **friend duels and private tables per track** (a friend duel *is* a private table, `matchmaking.md` §Private tables): `TableService` stores the host's track on the table
  (`TableDeps.trackOf`). Another track's player gets `NOT_FOUND` on join and `null` on `GET /tables/:code` (no table to find, nothing to explain); at `start` a seated player who moved track since joining is
  freed and the host gets `NEED_PLAYERS`. The match's puzzle pool already follows the first (host) player's track. The invite card goes to friends only, who are already same-track. Open: the host's
  «share to city chat» card still posts into the public city chat (leave to the chat slice: kid/teen must not use it), and the **family table** (guardian + own children) is phase 5.
- Phase 4, slice 3, **managed chat core** (owner confirmed the default: free text **on** between same-track friends once linked): `ChatService.managed` (`trackOf`, `hasGuardian`). For kid and teen:
  city and global rooms are closed (`OFF`, no socket room joined, no city «share» card); free text goes **only in a private chat with a same-track friend** and only while a guardian is linked
  (`guardian_links` row = the redemption of rule 7, so no invite code; no link → `NEEDS_GUARDIAN`; table or match text → `PHRASES_ONLY`, phrases always work); numbers, links and handles are blocked even with a contact perk;
  a private chat never crosses tracks even for an old friendship (`NOT_FRIENDS`); the composer flag `canType` follows the same rules. Removing the guardian link therefore closes text again (the interim «off switch»).
- Phase 4, slice 4, **per-track taunt library and stricter word list** (migration 0062): `taunt_categories.age_track` (the library is chosen per *category*, not per taunt, because categories already carry the city audience; this replaces the earlier `canned_taunts.age_track` sketch)
  and `blocked_words.track` (`all` | `kid_teen`). `ChatService.taunts(user)` lists only the categories of `trackRules(track).tauntTrack`, and sending a taunt of another library answers `UNKNOWN_TAUNT` (private chat and match alike); bots keep to the adult library.
  Free text of a kid/teen goes through the general list **plus** the `kid_teen` words (`TextFilterService.check(text, 'kid_teen')`). The store seeds a starter kid and teen library once per track (also on a database that already has adult taunts);
  the strict word list ships **empty** (a content call for the owner/moderators, edited in «فیلتر کلمات» with a «برای چه کسانی» select), and taunt categories get a library select in «کل‌کل‌های آماده». Emoji/sticker packs are not a separate table: emoji live inside taunt texts.
- Phase 4, slice 5, **social needs a guardian** (`trackRules.socialNeedsGuardian`: kid and teen true, adult false): `AgeTrackService.socialBlocked(userId)` is true for a kid/teen with no `guardian_links` row (never while the feature is off). It closes
  friend requests and accepts (`403 {error:"needs_guardian"}`), invite-link friending (`/friends/link`), and opening or joining a table (`403 NEEDS_GUARDIAN`). Play, bots, the same-track quick match, solo, the lesson and phrases never need it.
  The app opens the existing one-step `GuardianStep` over the current sheet the first time a friend or table call answers that code (`useGuardianGate` in `PlayerSheet` and `TableSheet`; «بعداً» just closes it), and asks again only while no guardian is linked.
  **Auto-accept between two kids needs no extra code:** the other child's accept is enough, with no guardian approval step (the default of §Friends, duels and chat). What is left is the quiet notice to the guardian, which belongs to the phase 5 digest, with the «ask me first» switch.
- Phase 4, slice 6, **separate kid/teen report queue**: `GET /admin/chat/reports?queue=all|minors|adults` (default `all`, so the old callers and the nav count are unchanged); each row carries the reported player's `track`, and `minors` = kid + teen
  authors (`ChatStore.reports({ queue })`, joined on `users.age_track`). The «گزارش‌های چت» view has a queue select and a track badge. A report row holds only the reported line and the reason (no surrounding chat), matching the privacy rule that a guardian
  or moderator reads a child's talk only when it is reported. Open: a role restriction for who may open the minors queue (all admin roles that can open chat reports can for now), and a separate nav count for it.
- Phase 4, slice 7 (closes phase 4): the invite-link deep link now opens the guardian step for a kid/teen with no guardian (`useInviteLink` returns the gate, rendered at the app root); search and contacts results open `PlayerSheet`, whose friend button already does.
  The kid/teen report queue is **role-gated**: `GET /admin/chat/reports` answers `minorsQueue: true` and serves `minors`/`all` only to roles that moderate (`users` or `messages`: owner, editor, support); a read-only viewer always gets the adult queue,
  whatever `queue` they ask for. The «گزارش‌های چت» select hides the minors option from others and shows its open count.
  Phase 4 is done; the guardian's own chat switch (phrases only / off) is phase 5.
- Not yet: the rest of the 30–50 kid puzzles; a track filter on the other admin lists (puzzles, items, tournaments, reports…);

## Phases

1. **Foundation:** `age_track` on users/puzzles/items, `trackRules`, chooser screen, track-keyed queues, admin band filter and config. No kid content yet.
2. **Guardian link:** phone OTP for the guardian, child profiles, link code, band-change confirmation.
3. **Kid content & lesson:** kid puzzle pool (30–50 hand-made to start), `item_lessons`, `splitWordLetters`, lesson cards, review queue.
4. **Social for kids and teens:** track-bound friends, friend duels and tables, managed chat (phrase library, filtered friends-only text, report queue).
5. **Guardian panel and digest:** the switches above, the digest («امروز چه یاد گرفت»), family table with the guardian.

## Open questions (proposed defaults)

- Band edges: up to 11 / 12–17 / 18+.
- Guardian step: **only for the social features** (friends, duels, tables, chat), asked once; play, bots and the same-track quick match need nothing
  (changed from the first proposal after the owner's note that restrictions must not bore kids).
- Free-text chat for kids: proposed **on by default between accepted same-track friends once linked**, with the strict filter, rate limit, report queue and the
  guardian's one-tap off. Owner to confirm this default (the safer alternative is phrases-only until the guardian turns text on).
- Can teen and adult share any table? Proposed: **no**, except the family table with the guardian.
- Whether Bazaar/Myket/Bale require extra age labelling or a privacy page for a kids' section: check store rules before phase 2 ships (owner).
- A mascot or kid art for the kid track: only inside the kid track and in the existing brand style; owner call.
