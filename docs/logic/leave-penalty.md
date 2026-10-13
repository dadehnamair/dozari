# Leaving a duel or table (D226 slice 3)

Owner (2026-10-12): leaving a table must cost something; too many leaves in a day close the game for that day; a month's worth earns a visible badge that comes off after a month; a sudden drop gets a grace to come back.

## What counts
- A **leave** = the player ends a running board by `match:leave` (`manual`) or stays disconnected past the grace (`absent`). Leaving a lobby, a finished match, or the price-guess round after the puzzle is decided costs nothing. Bots are never logged.
- Already true: the leaver forfeits (their entry fee goes to the other side).
- Every leave is a row in `match_leaves(user_id, match_id, kind, left_at)` (migration 0081).

## Rules (admin settings `leave.*`; defaults in `config/leave.ts`)
| setting | default | meaning |
|---|---|---|
| `leave.grace_seconds` | 90 | a dropped player keeps the seat this long; back in time = no leave |
| `leave.day_ban_count` | 4 | leaves in one Tehran day that close duels + tables until the day ends (0 = off) |
| `leave.badge_count` | 8 | leaves inside the window that put the «ترک‌کننده» badge on the profile (0 = off) |
| `leave.badge_days` | 30 | the counting window |

Pure logic: `leaveStatus` in `packages/shared/src/leave/policy.ts`. The badge is computed, not stored: it holds while `badge_count` leaves sit in the window and ends when enough of the oldest age out; `leaverUntil` (epoch ms) is that moment.

## Where it bites
- Queue join (`LEAVE_BANNED` socket error) and table create / join / request (`LEAVE_BANNED` table error). Solo and the daily puzzle stay open.
- Public profile (`PlayerProfile.leaverUntil`): a chip «ترک‌کننده»; a tap shows «تا ۲۸ مهر برداشته می‌شود».
- Leaving asks a second tap and says a leave will be recorded. It also says how many leaves remain today before the ban (`GET /me/leave-status` → `{today, left, bannedUntil}`, `LeaveService.warning`; read when the player arms «leave»; the last one says so).
- A dropped player: the gateway tells the other players of the match at once (`match:presence {userId, state:'dropped', graceEndsAt}`), and again when they are back (`state:'back'`); the screen shows «X قطع شد؛ N ثانیه منتظرش می‌مونیم» with the countdown. If the grace ends the leave is logged as `absent`.
- Admin tab «ترک بازی» (`GET /admin/leaves`, `LeaveService.log`): the newest 300 leaves with who, how (`manual` / `absent`) and when, a chip for repeat leavers, and the rules in force.

## Not built
A device push notification (outside the app) to the opponent when someone drops; the in-match notice above needs the app open.
