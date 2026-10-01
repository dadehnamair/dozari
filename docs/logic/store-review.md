# Store review prompts

Owner request (2026-10-01): ask players to rate the app on Myket, Bazaar and Bale; enabled and timed from the admin panel (e.g. after N days and N games). D75.

## Admin settings (group «نظر در فروشگاه‌ها», `review.*`)

| key | meaning | default |
|---|---|---|
| `review.enabled` | master switch | off |
| `review.after_days` / `review.after_games` | first ask after this many days since the first open **and** this many finished games | 3 / 3 |
| `review.repeat_days` | pause before asking again after «بعداً» | 30 |
| `review.max_prompts` | cap per device | 3 |
| `review.myket` / `review.bazaar` / `review.bale` | allow the prompt for builds shipped through that store | on |
| `review.package_id` | package id used to build Myket / Bazaar links | `ir.dozari.app` |
| `review.url_myket` / `review.url_bazaar` / `review.url_bale` | explicit store page links; empty = built from the package id (Myket `https://myket.ir/app/<id>`, Bazaar `https://cafebazaar.ir/app/<id>?l=fa`); the **Bale link is never guessed** and must be filled in | empty |
| `review.message` | the text in the dialog | friendly default |

## Client

The build is told which market it ships through: `EXPO_PUBLIC_STORE=myket|bazaar|bale` at build time (`APP_STORE`). Development and web builds have none and never ask.
State per device (first open, finished games, last prompt, prompt count, done) is kept in the keychain/localStorage as a small comma-separated text (no JSON).
`shouldPromptReview` (pure, tested) decides on Home; the dialog offers «نظر می‌دم» (opens the store page, stops asking), «بعداً» (asks again after `repeat_days`) and «دیگه نپرس». Only http(s) links are ever opened.

## Not verified

The store links and the Bale app-page format have not been checked against the real stores (no network here); in-store deep links (`bazaar://…`, `myket://…`) that open the rating dialog directly are not used, only the web page links.
