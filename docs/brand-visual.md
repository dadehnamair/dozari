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

## Color — pastel-paper palette (proposed default, 2026-09-27)

Owner asked for a pastel direction ("بنظرم پاستیلی چیز جذابی میشه") and left the exact tokens to
Claude. Implemented in both prototypes (`prototype/index.html`, `prototype/screens/shared.css`)
for the owner to react to — **proposed**, not a final locked palette (still needs an explicit
owner sign-off before it's `accepted`, the same as the display font below):

| token | light | dark | note |
|---|---|---|---|
| paper (bg) | `#FBF1E3` | `#241A12` | warm cream / warm near-black, never neutral gray |
| surface (cards) | `#FFFCF5` | `#2F2318` | |
| ink (text) | `#3B2A22` | `#F3E6D4` | warm coffee-brown instead of a cool near-black |
| accent (buttons/links) | `#E2984B` | `#E8A768` | warm caramel/amber — pastel-adjacent, distinct from all 4 group colors |
| muted / line | `#8A7563` / `#E9D8BE` | `#BBA48B` / `#493725` | |

- **Group colors** — unchanged, already defined and locked: yellow `#F9DF6D`, green `#A0C35A`,
  blue `#B0C4EF`, purple `#BA81C5` (`persian-rtl-ui` skill). They read as pastel already, so no
  change was needed to satisfy the pastel direction — the paper/accent tokens above were tuned to
  sit well next to them.
- Small playful touches added alongside the palette: a slight alternating tilt ("sticker") on tag
  chips and badges, per the mood reference (an old photo album with stickers doodled on it).

## Icon / app logo

**Not decided — explicitly deferred** (owner, 2026-09-27: "هنوز تصمیم نگرفتم، بعداً بررسی
می‌کنیم"). Do not design or lock an app icon/logo yet; when it's time, revisit against whatever
display font and color palette get chosen above so all three land together.

## Open follow-ups

- Pick the nostalgic display font (with real candidates shown to the owner, not assumed).
- Pick base "paper" background tokens (light + dark) and the primary accent color.
- App icon/logo — deferred until the above are settled.
