# Visual brand & tone

Owner-approved direction (2026-09-27). This is a starting point for a designer/AI to work from,
not a finished style guide — several tokens below are explicitly still open.

## Mood

**Nostalgia + playfulness, combined** — not a somber "museum" feel and not a generic bright
mobile-game feel on its own:

- **Nostalgic layer:** warm, aged-paper background tones; retro product photography treatment;
  a display typeface with an old/handwritten/printed feel for titles and brand moments (see
  §Typography — exact family still to be chosen).
- **Playful layer:** the bright, saturated Connections-style group colors (yellow/green/blue/
  purple, already defined in `persian-rtl-ui` skill §Visual language) carry the game's energy —
  used for puzzle rows, score accents, celebratory moments (round win, share card), not for large
  background fills. The paper tone stays the "quiet" base the playful colors pop against.

Reference feeling: an old family photo album (nostalgic) that a kid has doodled bright stickers
onto (playful) — both readable at once, neither fighting the other.

## Typography — two-font system

| role | face | status |
|---|---|---|
| UI/body text (all app chrome, buttons, forms, i18n strings) | **Vazirmatn** | decided (`persian-rtl-ui` skill; readable at small sizes, wide Iranian-app precedent) |
| Display/brand (logo, app name, section headers, share-card headline, group title reveal) | a **nostalgic-feeling Persian display face** — vintage/retro print or classic headline
  character, distinct from Vazirmatn | **not chosen yet** — owner wants to look at real
  candidates rather than pick blind. Needs a font that (a) is legible at large sizes only (it's
  never body text), (b) has a real Google Fonts or self-hostable Persian family (CSP/self-hosting
  rule in `ARCHITECTURE.md` still applies — no runtime Google Fonts fetch, bundle whatever is
  picked), (c) actually carries the "old newspaper/vintage" feeling rather than just being "a
  second sans". Track candidates and the final pick as a decision in `DECISIONS.md` once chosen. |

Until the display face is chosen, prototypes may fall back to a heavier Vazirmatn weight for
headlines — never ship that as final.

## Color — "Candy Arcade" palette v3 (proposed default, D55, 2026-09-28)

**Supersedes v2 below**, used in the new SPA prototype (`prototype/game.html`, D54). Owner asked
for a full game vibe, not a website vibe: "کامل میخوام وایب گیم باشه." Reference direction:
candy-vivid color energy (closest to Candy Crush Saga among the options discussed) plus glossy
chunky "shelf-edge" buttons (Coin Master/Clash Royale). **Deliberately not light/dark-adaptive** —
a real game's main menu doesn't reskin with the OS theme:

| token | value | note |
|---|---|---|
| background | `linear-gradient(165deg,#2A0E52 0%,#7A1E86 45%,#FF3D77 80%,#FF8A3D 100%)` | night-candy sky; two soft radial highlights layered on top |
| panel | `#3A1768` on `rgba(255,255,255,.14)` line | translucent-glass panels over the gradient |
| candy buttons | pink `#FF4D8D`, orange `#FF7A3D`, yellow `#FFC93C`, sky `#3FC1F0`, grape `#A66BF0`, lime `#7ED957` | each with a lighter top highlight + a solid "shelf" bottom border 4–6px darker, so buttons read as chunky 3D objects, not flat rounded rects |
| ink / cream (text) | `#2B1240` / `#FFF6E8` | dark ink only appears on light candy-yellow surfaces; cream is the default text color against the dark gradient |
| display type | Lalezar with a 3-direction fake-stroke `text-shadow` (sticker/logo effect) | used for the logo and scene headers only, never body text |

- **Group colors and chart colors** — unchanged, still locked: yellow `#F9DF6D`, green `#A0C35A`,
  blue `#B0C4EF`, purple `#BA81C5`; chart `s1–s4`.
- New: a hand-drawn mascot, «دایی‌دوزاری» (D56) — see `prototype/game.html`'s inline SVG.
- New: a hub screen with big glossy "portal" buttons instead of a list/nav (D54).

## Color — "cool arcade" palette v2 (superseded 2026-09-28, kept for history)

**Supersedes v1 below.** The owner rejected the pastel-paper execution outright: "این گرافیک
اصلا مناسب اپ نیستا باید خیلی کول‌تر باشه." Same nostalgia+playful *mood* (the group colors still
carry the "playful" energy against a quiet base) but the base moved from warm paper/coffee-brown
to a cooler, punchier, more contemporary "arcade quiz" chrome — closer to Kahoot/Duolingo energy
than a scrapbook. Implemented in both prototypes — **proposed**, not locked, same as the display
font below:

| token | light | dark | note |
|---|---|---|---|
| paper (bg) | `#F4F3FE` | `#0E0C1B` | cool near-white lavender / near-black indigo |
| surface (cards) | `#FFFFFF` | `#181430` | |
| ink (text) | `#161327` | `#F1EFFC` | cool near-black indigo instead of coffee-brown |
| accent (buttons/links) | `#6C5CE7` | `#8C7CFF` | vivid violet |
| accent-grad (primary CTAs, logo, level chip) | `linear-gradient(135deg,#6C5CE7,#00C2D6)` | `linear-gradient(135deg,#8C7CFF,#22E0C9)` | violet→teal, used for anything that wants to feel like a "big tappable" moment |
| muted / line | `#726D8E` / `#E4E1F7` | `#9C97BE` / `#2C2748` | |
| shadow | `0 10px 26px -8px rgba(22,19,39,.22)` | `0 10px 26px -8px rgba(0,0,0,.5)` | real elevation instead of a flat 1px line — panels/buttons/cards read as "lifted" |
| radius | `--radius-lg:20px` / `--radius-md:14px` | same | rounder than v1, part of the "cooler" read |

- **Group colors** — unchanged, still locked: yellow `#F9DF6D`, green `#A0C35A`, blue `#B0C4EF`,
  purple `#BA81C5` (`persian-rtl-ui` skill), as are the result-chart `s1–s4` line colors.
- Small playful touches from v1 carried over: the alternating "sticker" tilt on tag chips/badges,
  the level-up pop animation.

### v1 — pastel-paper (superseded 2026-09-27, kept for history)

| token | light | dark | note |
|---|---|---|---|
| paper (bg) | `#FBF1E3` | `#241A12` | warm cream / warm near-black |
| surface (cards) | `#FFFCF5` | `#2F2318` | |
| ink (text) | `#3B2A22` | `#F3E6D4` | warm coffee-brown |
| accent (buttons/links) | `#E2984B` | `#E8A768` | warm caramel/amber |
| muted / line | `#8A7563` / `#E9D8BE` | `#BBA48B` / `#493725` | |

## Icons

**Self-hosted SVG set** (`prototype/screens/icons.svg`, D36) replaces raw emoji for UI chrome —
bottom nav, mode cards, admin approve/reject/mute/ban actions, the chat FAB. 24×24 viewBox, 2px
round stroke, one consistent style. Hand-authored because this session's network policy blocked
fetching a named external package (npm/jsdelivr); each screen inlines the sprite's `<symbol>`
defs directly (`file://` pages can't `<use>` across files — cross-document fetches need a real
origin). Swap for a licensed pack later if/when that's reachable, or on owner request — see
`DECISIONS.md` open question 13. Product emoji on puzzle tiles are content, not chrome, and stay
emoji.

## Icon / app logo

**Not decided — explicitly deferred** (owner, 2026-09-27: "هنوز تصمیم نگرفتم، بعداً بررسی
می‌کنیم"). Do not design or lock an app icon/logo yet; when it's time, revisit against whatever
display font and color palette get chosen above so all three land together.

## Open follow-ups

- Pick the nostalgic display font (with real candidates shown to the owner, not assumed).
- Pick base "paper" background tokens (light + dark) and the primary accent color.
- App icon/logo — deferred until the above are settled.
