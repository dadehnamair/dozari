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
- "Dozari Site - Home/About/Download/Contact/Blog/Blog Post.dc.html" + `SiteNav`/`SiteFooter` = the landing site (`mrdozari.ir`, `apps/landing`, spec `docs/logic/landing-site.md`). Keep them in this folder: `support.js` loads components only from the page's own directory. The product is a price-nostalgia game (not a word game); show only real facts (no invented versions, stores, ratings or team). The Google Fonts `<link>` is mock-only; production uses system fonts / `landing.font_url`.

## Open TODO
- (Resolved) Eyes verified for all who × pose × anim combos. Blink wrapper now uses transform-box:fill-box.
