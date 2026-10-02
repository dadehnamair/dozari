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
- *INVITE_MAX_USES* = 10 per personal code (D79; admin-set; raise for influencers with a special code).
- **Gold rule (D79):** the personal code is issued only from level `invite.min_level` (3) and a wrong guess is rate-limited
  (8 tries / 10 min). Redeeming activates the account: free-text chat, renaming (`invite.required_for_rename`) and — when they ship —
  gifts and loans. The inviter is paid only after the invited player finishes `invite.reward_after_games` (3) games, once.
- Built: `invite_codes`, `invite_redemptions`, `users.chat_unlocked_at`; `GET /me/invite`, `POST /invite/redeem`; admin «کد معرف».
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
- As built (D69): `filterText`/`normalizeForFilter` in `packages/shared/src/text`, word list in `blocked_words` (severity block or mask), edited in the admin panel; server side `TextFilterService.check(text)` is the single gate for every player-typed text.
- Limits: *CHAT_MAX_LEN* = 120 chars, *CHAT_RATE* = 5 messages / 10 s; taunts 1 / 3 s.
- Per-user mute (client-side hide + server doesn't deliver), report button → `reports`, admin review.
- No links, no phone numbers (regex, Persian and Latin digits) in free text.
- Chat history retained 30 days for moderation, then purged.

## Canned taunts

Stored in `canned_taunts`, categories: greeting, brag, tease, gg, react. Examples:
«سلام! آماده‌ای ببازی؟»، «این یکی رو مامان‌بزرگمم بلد بود 😄»، «پیکان هم این‌قدر کند نبود!»،
«دمت گرم، بازی خوبی بود»، «یکی مونده بود، حیف!». Keep them playful, never insulting. Brand-flavored additions («دوزاریت هنوز تو راهه؟» etc.)
are listed in `docs/brand.md`.


## As built (D84): city chat and canned taunts

- **Rooms:** `city` (everyone whose profile city is the same; needs a city) and, in a duel, taunts to the opponent (`chat:taunt`). Private-table
  chat is not built (private tables are not built yet).
- **Send rules** (`apps/server/src/chat/service.ts`, all server side): chat switch `feature.chat`; muted players send nothing (taunts included);
  free text needs an activated account (`chat.text_needs_activation`) and at most `chat.max_len` (120) characters; text with a phone number, link or
  messenger handle needs the **«نشان تماس»** perk (`containsContactInfo`); the profanity filter (D69) always applies — no badge lifts it;
  rate limits 5 messages / 10 s and 1 taunt / 3 s per player (attempts count). Strangers in a duel get taunts only.
- **Canned taunts** are admin content: categories and taunts in `taunt_categories` / `canned_taunts`, edited in «کل‌کل‌های آماده» (starter set from
  `docs/brand.md`). Players never need an invite code to use them.
- **Reports and removal:** a player can report a message once (`chat_reports`); the admin sees reports, resolves them and removes the message
  (`deleted_at`); users can then be warned or muted from their dialog. «آجان دوزاری» can warn and mute (D83).
- **Live push:** sockets that sent `chat:join` receive `chat:message` for their city; the app polls every 4 s until it has a socket client.
- **Retention:** 30 days, purged every 6 hours.
- Not built: per-player mute lists, moderator-visible message context, a muting UI for agents in the app, text chat in private tables.


## City dialect phrases (owner item 9, D88)

A canned-taunt category may be tied to a city (`taunt_categories.city_id`, null = everyone). `GET /chat/taunts` returns general categories plus the caller's own city's; sending a taunt of another city's category is refused (`UNKNOWN_TAUNT`). Admin sets the city per category in «کل‌کل‌های آماده». Phrases themselves are content the owner writes there.
