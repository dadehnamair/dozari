# Rewarded video ads (D221)

Watch a short video, get a reward. **Everything is data**: where an ad may appear, what it pays and how often is a row in `ad_placements`, edited in the admin panel (اقتصاد ← تبلیغ ویدیویی). Nothing is on by default.

## Switches (all must be on)
1. `ads.enabled` (setting, economy group) — global kill switch, default **off**.
2. `ad_placements.enabled` for that placement, default **off**.
3. Age track: the `rewardedAds` track rule — **adult only**. `/ads*` answers 403 `age_track` for kid and teen (request gate); a child never sees an ad.
4. The app has an ad network ready (see "Ad network").

## Placements (`AD_PLACEMENTS`, shared `config/ads.ts`)
A placement is a fixed key wired to a screen in the app. Adding one = code change; tuning one = admin panel.

| key | screen | default reward |
|---|---|---|
| `coins_short` | the «سکه از کجا بیاورم؟» page (opened when a table/duel needs more coins) | 30 coins |
| `coin_shop` | shop, coins tab | 20 coins |
| `wheel_extra` | lucky wheel with no spin left | 1 spin |

Per placement: `reward_kind` (`coins | gems | hint_token | wheel_spin`), `reward_amount`, `daily_cap` (rewarded views per player per Tehran day), `cooldown_seconds` (between two views), `min_watch_seconds`.

## Flow (server decides the reward, rule 4/6)
1. `GET /ads` → `{enabled, offers[]}`: only placements the player can use now (not capped); `cooldownLeft` > 0 shows a disabled button.
2. `POST /ads/start {placement}` → `{viewId, minWatchSeconds}`; 404 `disabled`, 409 `capped` / `cooldown`. Reward and watch time are **snapshotted** on the `ad_views` row.
3. The app shows the ad through the provider.
4. `POST /ads/complete {viewId, proof?}` → pays once. Refused: 404 `not_found` (also another player's view), 409 `already`, `too_early` (less than `min_watch_seconds` since start), `expired` (> `AD_VIEW_MAX_AGE_SECONDS`).
   Coins/gems go through the ledgers (`ad_reward`, idempotency key `ad_reward:<viewId>`); a hint token goes to the inventory; a wheel spin is a `wheel_spins` row (`source=ad`).

## Ad network
The app talks only to `AdProvider` (`apps/mobile/src/ads/provider.ts`); a native glue for an Iranian network (Tapsell / Adivery, D18) must `registerAdProvider(...)` at startup. **No network SDK is bundled yet**, so in a release build no offer is shown at all. In `__DEV__` a stand-in provider "plays" an 11 s fake ad to try the flow.
Known limit: the completion is reported by the client (server only enforces the minimum watch time, cap and cooldown). When a network is chosen, add its server-to-server callback verification (`proof` is stored for that) before raising rewards or caps.
