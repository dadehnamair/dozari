# Brand — «دوزاری» (Dozari)

Final game name, chosen by the owner (2026-09-27, D24). Replaces the working title
«قیمتش چند بود؟». This file is the source of truth for the name, slogans, voice, and the
brand-flavored copy used across the app, store listing, and share cards.

> In-game UI strings still live in `apps/mobile/src/i18n/fa.ts` (CLAUDE.md language rules).
> This file lists the *approved copy*; when the i18n file exists, copy from here into it —
> never hard-code these inside components.

## The name

| | |
|---|---|
| Persian (canonical) | **دوزاری** |
| Latin / romanized | **Dozari** |
| Code identifier / package prefix | `dozari` |
| Deep-link scheme | `dozari://` (e.g. `dozari://room/<CODE>`) |
| Store title (Cafe Bazaar / Myket) | «دوزاری — بازی نوستالژی قیمت‌ها» |
| Players (nickname for the community) | «دوزاری‌باز» / «دوزاری‌بازها» |

### Why it works (the psychology — keep this reasoning when making brand calls)

1. **Double meaning, both on-theme.**
   - *دوزاری* = the old 2-rial coin (payphone coin) → pure price nostalgia, the game's content.
   - *«دوزاریت افتاد؟»* = "did the penny drop?" → the aha moment of solving a Connections
     group, the game's mechanic. Name = content + mechanic in one word.
2. **Piggybacks on existing memory.** Players don't learn a new word; they attach a new meaning to
   one they already know (existing retrieval cues → easier recall).
3. **Free daily triggers.** Iranians say «دوزاریت افتاد؟» in everyday conversation. Every time
   someone says it, the game comes to mind — external trigger for zero ad spend.
4. **Humor effect.** Puns and playful words are remembered better and retold more — good for
   word-of-mouth and the share loop.
5. **Sound.** Three syllables (دو-زا-ری), same rhythm as «آ-میر-زا»; ends in a warm, familiar
   «ی». Easy to say, easy to type, no spelling ambiguity.

### Usage rules

- Always written as one word: **دوزاری** (not «دو زاری»).
- Possessive forms follow speech: «دوزاریت»، «دوزاریم» (casual, preferred in UI); «دوزاری‌ات» only in formal text.
- Never mock the player's intelligence harshly — «دوزاریت کجه» is teasing, always paired with
  something warm. Same rule as canned taunts: playful, never insulting.
- The coin is the logo motif: a round 2-rial-style coin (original art — do not reproduce real
  banknote/coin imagery 1:1).

## Slogans

**Primary tagline (splash, store, share card):**
> ### دوزاریت می‌افته؟

**Secondary lines (store description, ads, social posts):**
- «یادته نوشابه چند بود؟ دوزاریت می‌افته؟»
- «قیمت‌های قدیم، رفیق‌های جدید.»
- «اون موقع که با یه دوزاری زنگ می‌زدیم...»
- «۱۶ تا جنس، ۴ تا دسته، یه دوزاری.»
- «نوستالژی رو بچین، رفیقتو ببر.»
- «مامان‌بزرگت بلده، تو چی؟»

**Invite / growth copy (share sheet, invite code):**
- «دوزاریت افتاد؟ بیا ببینم مال تو هم می‌افته! کد دعوت: {code}»
- «من تو دوزاری {score} امتیاز گرفتم. تو چند؟»
- «یه دوزاری بنداز، بیا یه دست بزنیم: {link}»

## In-game copy (brand voice)

To be moved into `fa.ts` when the mobile app exists. Keys are suggestions.

| Moment | Key (suggested) | Copy |
|---|---|---|
| Splash / loading | `brand.tagline` | دوزاریت می‌افته؟ |
| Loading (rotating) | `loading.*` | «دارم دوزاری می‌ندازم...»، «صبر کن، بوق آزاد بزنه...»، «قیمتا رو از انبار میارم...» |
| Correct group | `match.groupCorrect` | دوزاریت افتاد! 🪙 |
| Correct group, fast | `match.groupCorrectFast` | چه دوزاری‌ای! |
| Wrong guess | `match.guessWrong` | دوزاریت یه‌کم کجه! |
| One away | `match.oneAway` | یکی مونده بیفته! |
| Last mistake left | `match.lastLife` | آخرین دوزاری‌ته، حواست باشه! |
| Win | `result.win` | دوزاریت طلاست! 🏆 |
| Loss | `result.loss` | این‌بار دوزاری گیر کرد. یه دست دیگه؟ |
| Draw | `result.draw` | دوزاری‌ها هم‌زمان افتاد! |
| Perfect (no mistakes) | `result.perfect` | دوزاری تمام‌عیار! |
| Queue waiting | `queue.waiting` | داریم یه حریف دوزاری‌باز پیدا می‌کنیم... |
| Price-guess round | `priceGuess.title` | حدس بزن: چند دوزاری؟ |
| Empty wallet | `wallet.empty` | ته قُلکت یه دوزاری هم نمونده! |
| Daily bonus | `economy.dailyBonus` | دوزاری امروزت رسید! |

### Canned-taunt additions (DB content, `canned_taunts`)

Add to the categories defined in `docs/logic/chat-and-access.md`:

| Category | Taunts |
|---|---|
| greeting | «یه دوزاری بنداز، شروع کنیم!» |
| tease | «دوزاریت هنوز تو راهه؟»، «بوق اشغال می‌زنی!» |
| brag | «دوزاری من زودتر افتاد 😎» |
| react | «افتاد! افتاد!»، «ای بابا، گیر کرد!» |
| gg | «دوزاریت سلامت، بازی خوبی بود» |

## Tags / titles that reuse the brand (see `docs/logic/profile-and-identity.md`)

Suggested names for achievement/skill tags — naming only, unlock rules stay in the profile spec:

- «دوزاری طلا» — top skill rank.
- «تلفن‌عمومی» — played 100 matches.
- «قُلک‌دار» — held a large coin balance.
- «دوزاری‌تیز» — solved a group in the first turn.
- «کلکسیونر سکه» — collected every avatar in a gallery.

## Open (not decided)

- Domain and store-name availability for «دوزاری» / `dozari` — must be checked on Cafe Bazaar,
  Myket, and `.ir` / `.com` registrars before launch. Fallbacks: `dozari.game`, `playdozari.ir`.
- Logo/visual identity — not designed yet.
