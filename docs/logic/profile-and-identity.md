# Profile, identity & progression

Owner (2026-09-27): "پروفایل خیلی مهمه" — treat this as a first-class screen, not an afterthought.

## Name & avatar: gallery-picked, unlockable

- On account creation (first app open, no signup needed) the user gets a **random nickname and
  avatar** assigned from curated preset lists — never a blank/empty profile.
- Both are **picked from a gallery, never free text**: this sidesteps profanity/impersonation
  moderation entirely (no free-text nickname to filter — normalize/profanity-filter code in
  `chat-and-access.md` still applies to chat text, not to names).
- Customization unlocks with play count (progression hook, keeps early sessions moving toward a
  goal): avatar gallery unlocks after `AVATAR_UNLOCK_GAMES` = 3 finished games; nickname gallery
  unlocks after `NICKNAME_UNLOCK_GAMES` = 10 finished games. Both are config values in
  `packages/shared/src/config/game.ts`, owner-adjustable.
- Once unlocked, the picker stays open forever (re-picking doesn't re-lock it).
- "Finished game" = any completed solo, duel, team, or private match (abandons don't count —
  reuse the `abandon` result type from `matchmaking.md`).

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

## Invite/referral block

- Personal invite code as **copyable text** + a share button (WhatsApp, Telegram, generic
  Android/web share sheet).
- Live tracker on the profile: how many people used the code, how many completed redemption
  (per `chat-and-access.md`'s redemption flow), and how many are "pending" the inviter reward
  (waiting on the invitee's 3 matches per `economy.md`).
- The **same share action is also reachable directly from the match-result screen** (not only the
  profile) — the owner wants the growth loop available right when a player is most engaged, not
  buried behind a profile tab.

## Open follow-ups

- Exact skill-rank tier thresholds and the full achievement catalog are content work, not logic —
  track as a Phase 6/7 content task in `docs/PLAN.md`, not blocking Phase 0-A/0.
