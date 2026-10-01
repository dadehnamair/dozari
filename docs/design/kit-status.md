# Design kit → app: what is implemented

Source: `Dozari Visual Assets.dc.html` (Candy Arcade v3, exported from Claude Design). The file imports
`support.js` and a `Mascot` component that were **not** part of the export, so anything needing the mascot waits for them.

| Kit section | Status | Where |
|---|---|---|
| Colours: candy light/base/dark, group colours + shelves, ink, cream | done | `apps/mobile/src/theme/colors.ts` |
| Display font Lalezar (bundled via `@expo-google-fonts/lalezar`), body Vazirmatn | done | `App.tsx`, `fonts` in `colors.ts` |
| Line icons (42) | done | `theme/icons.ts`, `components/Icon.tsx` |
| Shelf buttons (light top edge, dark bottom shelf) | done | `components/CandyButton.tsx` |
| Board tiles (cream + shelf, selected grape), solved rows with shelf | done | `components/Board.tsx` |
| Screens: splash, home hub, backgrounds, parallax | todo | needs mascot + background art |
| Mascot poses, avatars, empty states | todo | `Mascot` component missing from the export |
| Effects (confetti, rain, twinkle…), banners, tier badges, era stamps | todo | |
| Hub icons (10 portals) | todo | |

The kit page loads Google Fonts at runtime; the app must not (CLAUDE.md rule 8), so fonts are bundled from npm packages.
