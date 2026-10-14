# Question workshop («کارگاه سؤال») — D237

Owner (2026-10-14): players design general four-choice questions; after the admin approves one the author is rewarded; reviewing other players' questions earns points; and the whole thing must be loud enough that people actually do it. Builds on `docs/logic/ugc.md` (product suggestions) and `docs/logic/trivia.md` (the question bank, no-repeat memory D236). Adult track only, like the other question modes (`priceOnly` rule); switch `feature.trivia_workshop`.

## Why a workshop
A topic needs about (G+1)×8 approved questions to avoid repeats for G games (trivia.md §No repeats); the admin alone cannot write that many. Players are the cheap source, the admin stays the final gate (nothing a player writes plays before an admin approves it).

## The loop
1. **Design** — a player writes a question: topic (required), text, four different choices, which one is right, an optional short explanation. Limit `trivia.submit_daily` (5/day). Server checks: `triviaInputSchema`; **near-duplicate** against the approved bank and the open submissions (normalised Persian text, token overlap ≥ 0.8 → `duplicate`, the app says «چنین سؤالی هست»). Status `pending`.
2. **Blind review** — other players (≥ `ugc.voter_min_games` finished games, never their own) get one card at a time: the question with its four choices **without the author's answer** (choices re-ordered per reviewer so position tells nothing). The reviewer (a) picks the answer they believe is right and (b) rates the question 👍 / 👎. Score of a review = +1 if their pick equals the author's answer else −1, plus +1 / −1 for the rating (−2…+2). One review per player per question.
3. **Auto-state** — at `trivia.review_approve_score` (6) with at least `trivia.review_min_reviewers` (3) reviews → `ready_for_review` (the admin queue, sorted by score); at ≤ −`trivia.review_reject_score` (5) → `rejected`. The admin sees per submission: score, reviewers, how many disagreed with the marked answer («جواب مشکوک» chip when ≥ 2).
4. **Admin decision** — approve as is, **edit & approve** (the usual question form), or reject with a reason (`wrong_answer`, `unclear`, `duplicate`, `off_topic`, `bad_taste`). Approving creates the `trivia_questions` row (`approved`, `author_id` = the player) and the question starts playing. Both decisions **settle** the reviews and message the author (in-app inbox + the Workshop page).

## Rewards (all numbers are admin settings, defaults in `config/topics.ts`)
### Author — paid once, when the admin approves
| part | default | when |
|---|---|---|
| base `trivia.author_coins` | 40 | every approved question |
| first-ever bonus `trivia.author_first_bonus` | 40 | the author's first approved question |
| milestone `trivia.author_milestone_bonus` | 50 | every 5th approved question (`trivia.author_milestone_every`) |
| thin-topic bonus `trivia.thin_bonus` | 15 | the topic has fewer than `trivia.thin_below` (40) approved questions when it is approved — the app flags these topics «🔥 کم‌سؤال +۱۵» in the topic picker |
| boost `trivia.author_boost_percent` | 0 | a campaign multiplier on the whole reward (100 = double); while it is on the Home card and the Workshop say «پاداش دو برابر!» |

Coins through the ledger, reason `ugc_reward`, key `trivia_author:<submissionId>` (idempotent). Beyond coins: the approved question shows **«✍️ طراح: <nickname>»** in the reveal card of every game it is played in, and the author sees **how many times it was played** (`trivia_questions.plays`) in «سؤال‌های من».

### Reviewer — points (امتیاز بازبینی), not coins per click
- **+1 point per review** (counted up to `trivia.review_daily` = 20 reviews per Tehran day).
- **Settlement bonus `trivia.review_agree_bonus` = +3** once the admin decides, to a reviewer whose blind pick matched the author's answer **and** whose rating agreed with the outcome (👍 on an approved question, 👎 on a rejected one). Rubber-stamping or random picks earn the base point only.
- **Milestone coins**: every `trivia.review_milestone_points` (30) points pay `trivia.review_milestone_coins` (10) coins (ledger `ugc_reward`, key `trivia_review:<user>:<n>`).
- **Titles** from the total points: 0 «تازه‌کار» · 30 «بازبین» · 120 «بازبین حرفه‌ای» · 400 «داور ارشد» · 1000 «استاد کارگاه».
- Faucet size: at most 20 reviews/day = 20 base points ≈ 6.7 coins/day plus agreement bonuses (≈ +60 points/day only if every review is right and decided); the author reward is a one-off per approved question. Both are small next to the sinks in `economy-v2.md`; the author reward is the real lever and is gated by a human.

## Making people want to do it (the "loud" part)
1. **Home card** «✍️ سؤال بساز، ۴۰ سکه بگیر» with a pulsing ribbon: the live reward (with 🔥 «×۲» during a boost), and a red badge with the number of questions **waiting for the player's review** («۱۲ سؤال منتظر نظر توئه»). Hidden for kid/teen and when the switch is off.
2. **Call-to-action after every question game** (solo result, question-duel result): «از این سؤال‌ها خوشت اومد؟ خودت بساز و ۴۰ سکه بگیر».
3. **Thin-topic hunt**: the topic picker in the form shows each topic's question count and flags thin ones with the extra bonus.
4. **Credit and plays**: the author's name on the question in every game, and a play counter ("سؤالت ۱۲۰ بار بازی شد") — the social reward.
5. **Celebration**: when the player opens the Workshop after an approval they see a confetti card «سؤالت تأیید شد! +۴۰ سکه» (and an inbox message when they were away); a rejection says why, kindly, with the reason.
6. **Leaderboards** on the Workshop page: top authors (approved count) and top reviewers (points), this week and all time; your own rank and title.
7. **Boost campaigns**: the admin raises `trivia.author_boost_percent` for a weekend and the card, the post-game call-to-action and the form header all say so.

## Entry: the «قیمت/سوال» tab (D239)
Owner design (`docs/design/adult/Dozari Adult - Login Home.dc.html`): a small gold tab hangs under the coin plate on the adult Home, pulsing with a light glint sweeping across it, and a red badge with the number of questions waiting for the player's review. It opens one sheet (`SchoolSheet`) with **two sections**:
- **قیمت** — suggest an item/price and vote on others' suggestions (the existing product UGC, `ugc.md`).
- **سؤال** — «ساختن سؤال» and «بازبینی سؤال‌ها» (with the waiting count) open the workshop screen on the matching tab; the reward line shows the live author coins.
The question section (and the badge) exist only while `feature.trivia_workshop` is on and the track is adult; otherwise the sheet is price-only. The Home card and the post-game call-to-action stay. The hub building «مکتب‌خانه» opens the same sheet.
(The file `Dozari Adult - Workshop` in the design set is the **settings page** named «کارگاه» in the hub, unrelated to this feature.)

## Abuse guards
Daily submit limit; duplicate check; reviewers cannot review their own; one review each; reviews counted per day; the admin is the only publisher; settlement bonus needs a matching blind answer; an author whose last 5 decided questions were all rejected is limited to 1 submission a day for 3 days (`trivia.cooldown`, later). Reviews are anonymous to the author; the author is never shown to reviewers.

## Data
- `trivia_submissions(id, user_id, topic_id, text_fa, option_a..d, correct_index, explanation_fa, status pending|ready_for_review|approved|rejected, score, reviews, disputes, reject_reason, question_id, rewarded_at, created_at, decided_at)`.
- `trivia_reviews(submission_id, reviewer_id, answer_index (original index), quality ±1, points, settled_at, created_at)`, unique (submission, reviewer). Reviewer points = SUM(points); no separate table.
- `trivia_questions` gets `author_id` (nullable) and `plays`.

## API (player, auth)
`GET /workshop` (home card + page header: boost, reward preview, `waiting` reviews, my title/points, my counts) · `GET /workshop/topics` (topics with counts + thin flag) · `POST /workshop/submissions` · `GET /workshop/mine` · `GET /workshop/review` (next card, `locked` until enough games) · `POST /workshop/review/:id {answerIndex, quality}` · `GET /workshop/top`.
Admin: `GET /admin/workshop?status=`, `POST /admin/workshop/:id/approve {edit?}`, `POST /admin/workshop/:id/reject {reason}`; admin page «کارگاه سؤال».

## Not built
Reviewer accuracy tiers, author cooldown, edit-and-resubmit of a rejected question, a push notification (outside the app), kid/teen authoring.
