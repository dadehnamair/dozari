---
name: puzzle-design
description: Author, generate, validate, or review Connections-style puzzles (16 items, 4 groups) for the Iranian price-nostalgia game. Use for anything about group rules, difficulty levels (yellow/green/blue/purple), witty Persian group titles, red herrings, the puzzle generator/validator, or when asked to "make a puzzle" / «پازل بساز» / «دسته‌بندی».
---

# Puzzle design

Spec: `docs/logic/puzzle-generation.md` (rule kinds, validator, generator). Read it first.

## Golden rules

1. **Exactly one solution.** Every item fits its own group's rule and **no other** group's rule.
   Always run `validatePuzzle` (hard checks 1–4). Never ship a puzzle that only "feels" unique.
2. **Title ≠ rule.** `rule` is objective (checkable from price data). `title_fa` is indirect & funny.
   `explanation_fa` states the rule plainly and is shown with the title after solving.
3. **Nominal prices only**, Solar Hijri years, using `priceAt(product, year)`.
4. **Difficulty ladder:** yellow = obvious anchor (era icon, wide band) → purple = sneaky (multiplier,
   first-crossed, narrow band). Purple should make players say «ااا! راست میگه!».
5. **Red herrings are the fun:** aim for ≥ 2 items that *almost* fit another group (e.g. price just
   outside the band, same era but different year).
6. **Diversity:** ≤ 6 items per category, ≥ 3 categories; prefer products with images and high nostalgia.

## Writing Persian titles (content, lives in DB)

- Short (≤ 40 chars), colloquial Tehrani register, playful, never insulting to groups of people.
- Hint at the rule through a memory, feeling, or situation — not the number itself.
- Good: «چیزهایی که مامان‌بزرگ‌ها ازشون شاکی‌ان»، «با پول تو جیبی یه هفته‌ی دهه‌شصتی»،
  «از کیوسک سر کوچه، سال ۷۵»، «اونایی که یه‌شبه صد برابر شدن».
- Bad: «قیمت ۱۰۰ تومان در سال ۱۳۷۵» (that's the explanation, not a title); anything political/ethnic.
- Explanation template: «همه‌شون سال {year} حدود {price} بودن» / «اولین بار دهه‌ی {decade} از {threshold} رد شدن».

## Hand-authoring a curated puzzle (checklist)

- [ ] Pick 4 rules, one per level; write rule JSON per the kinds table.
- [ ] For each rule list *all* catalog products satisfying it — if an unwanted product satisfies it,
      either keep it off the board or tighten the rule.
- [ ] Choose 4 items per group; check every item against the 3 other rules (write the 16×4 matrix
      in the PR/description if hand-made).
- [ ] Titles + explanations in Persian; run validator; save as `draft`; admin approves.

## Adding a new rule kind

Evaluator in `packages/shared/src/puzzle/rules/<kind>.ts` + zod param schema + unit tests
(satisfies / not-satisfies / missing data) + row in the spec table + generator instantiation + title templates.
