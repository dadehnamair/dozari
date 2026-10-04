# Badges, medals, notices and «آجان دوزاری» (owner backlog items 22, 23, 24)

## Badges and medals

Catalog `badges` (admin-edited): title, description, kind (**badge** = can be shown next to the name; **medal** = shown in the medal row),
icon, **perk**, and an optional automatic rule (`metric` games | wins | level, `min`). `user_badges` holds what a player earned; a rule is
checked after every finished game (`BadgeService.evaluate`) and an admin can grant or revoke any badge by hand. A locked badge is shown to the
player with how far along they are. Starter catalog: «نشان تماس» (level 10, perk share_contact), «آجان دوزاری» (admin-granted, perk moderator),
medals «اولین قدم» (1 game), «کهنه‌کار» (50 games), «برنده» (20 wins).

## Perks

- `share_contact` — may send phone numbers, links and IDs in free-text chat (`containsContactInfo` in shared; the chat feature must call it
  and refuse the message unless the sender holds this perk — chat is not built yet).
- `moderator` — **«آجان دوزاری»**: may **warn** (a notice the player sees, also sent through Bale) and **mute** in chat for a short time
  (`mod.max_mute_minutes`, default 60), at most `mod.agent_actions_per_day` (20) actions a Tehran day. Agents cannot act on themselves or
  on other agents; an admin can. Every action is logged in `mod_actions`. The mute lives in `chat_mutes`; chat must call `BadgeService.isMuted`.

## Notices

`user_notices`: warnings and commendations (by admin or agent), private to the player (never on the public profile), listed in
«نشان‌ها و پیام‌ها» with unread tracking.

## Skill tier («سطح مهارت»)

`skillTier(games, wins)`: تازه‌کار below `skill.min_games` (10); حرفه‌ای with ≥ `skill.pro_games` (30) games and ≥ `skill.pro_win_percent`
(60 %) wins; مبتدی between. Cosmetic, never used for matchmaking (D12). Public profile shows: equipped badge, up to 6 medals, skill tier, city,
games and wins, level.

API: `GET /me/badges`, `PUT /me/badge`, `POST /me/notices/read`, `POST /mod/warn`, `POST /mod/mute`; admin `/admin/badges`, and per player
`/admin/users/:id/badges|notices|mute` (permission `users`).
