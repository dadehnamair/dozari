# Profile, identity & progression

Owner (2026-09-27): "پروفایل خیلی مهمه" — treat this as a first-class screen, not an afterthought.

## Name & avatar: gallery-picked, unlockable

- On account creation (first app open, no signup needed) the user gets a **random nickname and
  avatar** assigned from curated preset lists — never a blank/empty profile.
- Both are **picked from a gallery, never free text**: this sidesteps profanity/impersonation
  moderation entirely (no free-text nickname to filter — normalize/profanity-filter code in
  `chat-and-access.md` still applies to chat text, not to names).
- Two layers (D65, owner 2026-10-01):
  1. **Free pick.** After `AVATAR_UNLOCK_GAMES` = 3 finished games the player picks one avatar from the *free* set;
     after `NICKNAME_UNLOCK_GAMES` = 10 finished games, one nickname from the free set. Both counts are meant to be
     editable from the admin panel (not built yet; config values in `config/game.ts` for now).
  2. **Everything else costs coins** (the rest of the avatars and nicknames), and buying/changing to them needs an
     **activated profile** (an invite code redeemed, `users.chat_unlocked_at`) **and** a minimum level:
     `AVATAR_CHANGE_MIN_LEVEL` = 3, `NICKNAME_CHANGE_MIN_LEVEL` = 5 (proposed numbers). Pure check: `canCustomise`.
  Prices and the free/paid split of the lists are not decided yet.
- Once unlocked, the picker stays open forever (re-picking doesn't re-lock it).
- Levels come from `progression.md`; the server must enforce the gate on the change endpoint (not built yet).

### As built (guest account)
`POST /auth/guest {deviceId}` creates the account on first sight (no sign-up) and returns `{token, user}`; the same device id
always gets the same account, concurrent first requests included. The token is an HS256 JWT (`sub` = user id, 30 days,
`JWT_SECRET`); `GET /me` with `Authorization: Bearer <token>` returns the profile. The nickname and avatar come from the
preset lists in `packages/shared/src/identity` (avatars = the 24 design-kit faces). A banned user gets 403 at login and
401 everywhere else. The unlock thresholds are `AVATAR_UNLOCK_GAMES` / `NICKNAME_UNLOCK_GAMES` in `config/game.ts`; the paid-change gate (`canCustomise`) exists in shared; the change/buy endpoints do not yet.

## Tags (badges shown next to the avatar)

Four kinds, owner-approved (2026-09-27), all stored as rows a user can *earn*; only one is
*equipped* (shown) at a time, chosen by the user from their earned set:

| kind | example | source |
|---|---|---|
| Achievement/honorary | «قهرمان دهه‌۶۰» | unlocked by achievement rules (win N matches on decade-60-heavy puzzles, etc.) |
| Skill rank | «تازه‌کار» / «مبتدی» / «حرفه‌ای» | derived automatically from win rate / games played — no ELO, just a coarse tier (consistent with D12: no matchmaking rating, this is cosmetic only) |
| Special/purchased | «حامی از روز اول» | granted by admin for campaigns/early supporters, or a future purchase — not sold at MVP |
| Self-unlocked | any tag the user has earned | equip whichever earned tag you like — this is the "tag قابل‌انتخاب توسط خودم" the owner asked for |

`user_tags(user_id, tag_id, earned_at)` + `users.equipped_tag_id`. A tag catalog table defines
label, icon, and unlock rule per tag — content-managed like `canned_taunts`, not hardcoded in UI.

## Profile screen contents (owner-approved list, 2026-09-27)

- Stats: games played, win/loss (split by mode optional), price-guess accuracy % (avg error tier).
- Recent match history: result, opponent nickname/avatar, coins won/lost, mode, date.
- Achievements/badges (the earned-tags list, with locked ones grayed out and their unlock rule shown).
- Chat-lock status: whether an invite code has been redeemed (`chat_unlocked_at`), with a
  "redeem a code" CTA if not — surfaces the `chat-and-access.md` gate directly on the profile
  instead of burying it in settings.
- Invite/referral block (see below).
- Optional phone link (see below).

## Phone number link — fully optional, backup only

- **Never required to play, never required to chat, never gates any feature.** The owner was
  explicit: "کاملاً اختیاری، فقط برای حفظ پیشرفت."
- Purpose: let a guest account survive a reinstall / new device by attaching an OTP-verified
  phone number to the existing account (merge, not create-new). Entry point: a "لینک شماره برای
  حفظ پیشرفت" button on the profile screen — never forced during onboarding.
- OTP via the Iranian SMS providers already chosen in `ARCHITECTURE.md`/D18 (Kavenegar, SMS.ir,
  or Ghasedak). No password — phone + OTP is the whole recovery flow. Losing the phone number
  with no OTP access = account unrecoverable (acceptable for MVP; documented, not solved here).

### Phone login («ورود با شماره»)

Built beside the link flow (`apps/server/src/phone/login.ts`, `POST /auth/phone/code`, `POST /auth/phone/verify`; app: settings → «ورود با شماره»).
Logged out, the player asks for an SMS code for a number and proves it: a number that an account holds logs in to **that** account (device
claimed, `AuthService.sessionFor`); a number nobody holds is attached, verified, to this device's guest account (a new one on a fresh install).
Codes are 5 digits, 5 min, 5 tries, 60 s resend, 5 codes/hour per number, 20 calls/10 min per IP; kept in memory. `sms_unavailable` (503) when no
SMS provider key is set. The answer never tells before the proof whether a number has an account.

## Invite/referral block

- Personal invite code as **copyable text** + a share button (WhatsApp, Telegram, generic
  Android/web share sheet).
- Live tracker on the profile: how many people used the code, how many completed redemption
  (per `chat-and-access.md`'s redemption flow), and how many are "pending" the inviter reward
  (waiting on the invitee's 3 matches per `economy.md`).
- The **same share action is also reachable directly from the match-result screen** (not only the
  profile) — the owner wants the growth loop available right when a player is most engaged, not
  buried behind a profile tab.

## Friends & player browsing (D44)

Players can browse other users and send friend requests — a new surface, not covered by the
existing tag/history/invite sections above. Owner: "ما بتونیم بقیه رو هم ببینیم و درخواست دوستی
بدیم." Needs a `friendships` relation in `data-model.md` (not yet added — request/accepted state,
bidirectional visibility) beyond what's currently specced. Entry points: a "دوستان" panel on the
profile screen (accepted friends only) and a full browse/search + add-friend list on the
leaderboard screen (`app-screens.md` §Leaderboard & tournaments). Prototype:
`prototype/screens/profile.html` §دوستان, `prototype/screens/leaderboard.html` §بازیکنان tab.
Open: what a friendship unlocks beyond visibility (e.g. inviting a friend directly to a private
table) — not designed yet.

### Tappable names → public profile sheet (D67)

Every place a player's nickname appears (match, result, leaderboard, friends, chat, search) is tappable and opens a
bottom sheet: avatar, nickname, member since, level + tier, cups (tournament trophies), coins, medals/tags, win stats,
and a «درخواست دوستی» button (state: none / sent / friends). The sheet reads one public-profile endpoint that never
reveals `is_bot`. v1 built: endpoint, `friendships` table, `PlayerSheet`; wired from the friends list only until other screens exist.

## Gender setting (D68)

An optional choice, female or male, set next to the province/city. It only changes presentation: the hero character and the
app icon take that gender. Stored in `users.gender` (nullable), set from «پروفایل من»; Home already draws the matching hero. The app icon switch is not built; see D68 for the open points.

## Profile-completion rewards (D161)

Home's guide character points at the next missing profile step and says what it pays («شهرت را در پروفایل انتخاب کن و ۲۰ سکه بگیر»).
Steps: `gender`, `city`, `phone` (verified), `bale` (linked). Nickname and avatar are always set at signup, so they are not steps.

- **Reward per step** is an admin setting (`profiletask.coins_<key>`, defaults 10 / 20 / 50 / 30 coins; 0 = no reward and no nudge).
- **One-time, server-checked:** `GET /me/profile-tasks` lists each step as `done` (the field is really filled in, read from `users` /
  `bale_links`), `claimed` and `coins`; `POST /me/profile-tasks/:key/claim` pays only when `done` and not yet `claimed`. The claim row
  (`profile_task_claims`, PK user + key) is the lock and the ledger key `profile_task:<user>:<key>` makes a repeat pay nothing.
- **Order of the nudge:** a finished step whose reward is waiting comes first (tap = take it), else the first unfinished one (tap =
  open the profile sheet, settings or the Bale sheet). A step whose screen is switched off is skipped.
- Birth date (D160) will become a fifth step when it is built.

## Birth date and age display (D160, proposed — not built)

An optional field set from «پروفایل من», next to gender and city. Policy:

- **Stored as a Solar Hijri date** (`users.birth_year`, `birth_month`, `birth_day`, all nullable; year 1300..current−10, a real
  calendar day). Gregorian is only a display helper (rule 3). The full date is **never sent to other players**.
- **Age is derived**, never stored. A tick «سنم نمایش داده شود» (`users.show_age`, default **off**) controls whether other players
  see the age (whole years, e.g. «۲۴ ساله») on the public profile sheet. Off = the profile shows no age at all.
- **Minimum age 10** (`config`, owner-set 2026-10-03). A birth date that makes the player younger than 10 is not saved; the
  field stays empty and nothing else changes for them.
- **Birthday week.** Starting **3 days before** the birthday and lasting **7 days** (3 before, the day, 3 after), the player's own
  profile and their public profile sheet show a party look (balloons/confetti, a «تولدت مبارک» banner). Whether others see the
  party follows the age tick: with the tick off, others see the party without any age or date.
- **Birthday gift**, claimable once per year during that week (idempotent per year, via `LedgerService` for coins): the amounts
  are **admin settings**, never code literals (rule 9). Starting values: **100 coins, 5 gems, 2 wheel spins**. The wheel
  spins follow the spin policy of D156. **Gems do not exist in the economy yet**: item 1 of the backlog introduces the gem
  prize kind, so the gem part waits for it (or is dropped to zero) until then.
- **Other uses (server-side, none changes fairness):** aggregated age-band stats in the admin dashboard (never per-user) and
  message targeting by age band in the message centre.
- **Privacy:** the date is personal data; the admin user sheet shows age only, the exact date only to the owner role; deleting
  the field clears it. Never put it in logs, share cards or socket payloads.

Open for the owner: whether the party look also shows on the match screen name tag, and what a gem is for.

## Province/city (D53)

An **optional** profile field — province required, city optional — never a gate on play (same
spirit as D22's optional phone link; the brief's "entry must be frictionless" rule still applies).
Owner: "اگه از افراد استانشون رو هم بپرسه بد نیست، بشه یه کل‌کل‌های شهری هم راه انداخت." Powers a
regional filter on the leaderboard (`app-screens.md` §Leaderboard & tournaments) and, longer-term,
"city crews" — persistent regional teams/rivalries, which is a bigger social-feature question not
designed here (`DECISIONS.md` open question 17). Where to ask (onboarding step vs. profile-only,
picked reactively) is still open; the prototype puts it as a profile-only optional field
(`prototype/screens/profile.html` §استان).

**Built (D101):** the player picks a city on the «شهر من» page (badge grid, Iran then abroad); the
city's `province` key maps to shared `PROVINCES`, which themes Home (badge + local greeting under
the wordmark) and shows the badge beside the city on profiles. The admin sets a city's province.

## Open follow-ups

- Exact skill-rank tier thresholds and the full achievement catalog are content work, not logic —
  track as a Phase 6/7 content task in `docs/PLAN.md`, not blocking Phase 0-A/0.
