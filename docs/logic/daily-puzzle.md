# Daily puzzle (owner item 15, D87)

One puzzle per Tehran calendar day, the same for everyone, chosen by the day's conditions: an occasion, a season, a trend, or a category.
One attempt per player per day; a solve pays a small coin reward that grows with the win streak.

## Data (migration 0022)
- `puzzle_themes`: title, kind (`occasion|season|trend|category|custom`), weight, optional yearly Solar Hijri window (start/end month+day, may wrap
  the year end), optional absolute Gregorian window (`from_date`/`to_date`, Tehran time), `is_active`.
- `puzzle_theme_links` (theme, puzzle): which approved puzzles belong to a theme.
- `daily_puzzles` (`date_key` PK `YYYY-MM-DD`): the chosen puzzle, its theme, `pinned_by` auto|admin. Written the first time the day is needed, then frozen.
- `daily_puzzle_plays` (user, date_key): `playing|won|lost`. The primary key is the one-attempt rule.
- Ledger reason `daily_puzzle`, key `daily_puzzle:<date>:<user>`.

## Selection (`pickDaily`, shared, pure and seeded by the date key so every instance agrees)
1. An admin pin for the date wins.
2. Themes active that day, in weighted random order; the first with a linked approved puzzle not used in the last N days wins.
3. Else any approved puzzle not used in the last N days; else any approved puzzle.

## Play
`GET /daily-puzzle` → state (`available|playing|won|lost|unavailable`), theme title, reward, streak. `POST /daily-puzzle/start` starts the attempt
as an ordinary solo game on that puzzle (`/solo/:id/...`), tagged `daily:<date>`; the finish hook records the result and pays once.
A `playing` attempt can be restarted if the server lost the session (same attempt; mistakes reset: accepted trade-off). A finished attempt returns 409 `done`.
Reward = base + step × (streak−1, capped at max days). Streak = consecutive won days ending today (or yesterday while today is open).

## Settings (admin → settings)
`feature.daily`, `daily.reward_coins` 20, `daily.streak_step` 5, `daily.streak_max_days` 7, `daily.repeat_days` 30.

## Admin ("پازل روز")
Create/toggle/delete themes, link puzzles to a theme, 14-day schedule with preview of what the picker would choose, pin or unpin a day
(refused once someone has played it).

## Not built
Daily leaderboard / share card, notifications ("today's puzzle is up"), UGC puzzles in themes, auto-suggesting trend themes from price data.
