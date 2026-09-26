# Access, invite codes & chat

## Two independent gates (brief — accepted)

| capability | requirement |
|---|---|
| Open the app, play every mode | nothing (guest account created silently) |
| Canned taunts («کل‌کل‌های آماده») | nothing |
| Free-text chat | `users.chat_unlocked_at IS NOT NULL` |

They are **not** combined with AND/OR — playing never requires a code; chat unlock never requires
anything but a code.

## Invite codes

- Every user gets a personal code (6 chars, alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ`).
- Redeeming a valid code (not own, not already redeemed any code, owner not banned, `uses < max_uses`)
  → sets `chat_unlocked_at = now()`, `invited_by = owner`, economy invitee bonus, creates pending
  inviter reward (economy.md).
- Redemption possible any time (onboarding screen or settings), exactly once per account.
- *INVITE_MAX_USES* = 50 per code (raise for influencers via admin).
- Admin can issue special codes (campaigns) with custom max uses; admin can revoke chat unlock (abuse).

## Channels in a match (proposed — open question 3)

| channel | who can read | who can post taunts | who can post free text |
|---|---|---|---|
| `team` (2v2 only) | the 2 teammates | both | unlocked teammates |
| `all` | all match participants | everyone | unlocked players, **only in private tables**; in queue matches (strangers) `all` is taunts-only |

Rationale: strangers from matchmaking can't harass each other with free text; friends at a private
table (who likely invited each other) can talk freely; teammates need real coordination.

A free-text message from an unlocked sender is visible to everyone in the channel, including
non-unlocked readers (the gate is on *sending*).

## Safety

- Normalize before filtering: Arabic ي/ك → Persian ی/ک, remove ZWNJ/diacritics/repeated letters,
  Finglish transliteration map for common profanity.
- Profanity match → message blocked with a friendly notice (not silently dropped).
- Limits: *CHAT_MAX_LEN* = 120 chars, *CHAT_RATE* = 5 messages / 10 s; taunts 1 / 3 s.
- Per-user mute (client-side hide + server doesn't deliver), report button → `reports`, admin review.
- No links, no phone numbers (regex, Persian and Latin digits) in free text.
- Chat history retained 30 days for moderation, then purged.

## Canned taunts

Stored in `canned_taunts`, categories: greeting, brag, tease, gg, react. Examples:
«سلام! آماده‌ای ببازی؟»، «این یکی رو مامان‌بزرگمم بلد بود 😄»، «پیکان هم این‌قدر کند نبود!»،
«دمت گرم، بازی خوبی بود»، «یکی مونده بود، حیف!». Keep them playful, never insulting.
