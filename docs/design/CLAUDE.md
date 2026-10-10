# Dozari (دوزاری) — mobile/tablet word-puzzle game, Persian RTL

## Style
- Hand-drawn look: wobbly pencil outlines (#3A2418), flat fills, white highlight strokes, pink cheeks. NO paper/blotch noise on characters.
- Fonts: Lalezar (display), Vazirmatn (text), JetBrains Mono (labels). Ink #2B1240, cream #FFF6E8.
- Candy palette kept varied across project: pink #FF4D8D, orange #FF7A3D, yellow #FFC93C, sky #3FC1F0, grape #A66BF0, lime #7ED957.
- Reference images: uploads/Dozari (UI refs), uploads/Dozari1 (market/painted style refs).

## Shared components (reuse, don't duplicate)
- Character.dc.html — props: who (dozari, dozariF, mashti, khale, pahlevan, baqal, mirza, goli, ajan), pose (12), month (1–12, dozari/dozariF costumes), anim (bool, subtle bob/blink/arm), crop (full/face).
- Scene.dc.html — painted backgrounds: scene = bazaar/alley/hojre/caravan/win, mood = day/dusk.
- Item.dc.html — item icon pack (57 icons, 64 viewBox). Add new icons as one line in the `I` map.
- Mascot.dc.html — old coin mascot (deprecated, replaced by Character).

## Files
- "Dozari - 01…12 *.dc.html" = one file per section; "Dozari Visual Assets.dc.html" = all-in-one.
- `site/` = landing site: "Dozari Site - Home/About/Download/Contact/Blog/Blog Post.dc.html" + `SiteNav`/`SiteFooter` (`mrdozari.ir`, `apps/landing`, spec `docs/logic/landing-site.md`). `support.js` loads components only from the page's own directory, so `site/` holds its own copies of `support.js`, `Character` and `Item` — keep them in sync with the root versions. Same for `yadegar/support.js`.
- Age-split designs: `kids/` = کودک/نوجوان versions, `adult/` = بزرگسال versions; shared/general designs stay at root. Both folders hold their own copies of `support.js`, `Character`, `Item`, `Scene`, `Logo` — keep in sync with root.
- Adult style (locked): «صرافی و گاوصندوق» — near-black #0E0A08/#17100C panels, gold #E8B64A frames + black outer ring, brass gradient buttons (#FFF1B8→#E8B64A→#B8822A→#8A5A16, text #2A1606), cream-gold text #FFE9A8, guide = mashti, bazaar-casual tone, low motion. Reference: `adult/Dozari Adult - Login Home.dc.html` (login, home = real HomeScreen layout, hub). Component kit: `adult/Dozari Adult - UI Kit.dc.html`. Metals: gold = primary/play, copper = duel/competition, silver = price-guess (حدس قیمت), dark bronze = secondary, red = danger. Scene `sarafi` (vault room) = adult indoor background. The product is a price-nostalgia game (not a word game); show only real facts (no invented versions, stores, ratings or team). The Google Fonts `<link>` is mock-only; production uses system fonts / `landing.font_url`.

## Open TODO
- (Resolved) Eyes verified for all who × pose × anim combos. Blink wrapper now uses transform-box:fill-box.
