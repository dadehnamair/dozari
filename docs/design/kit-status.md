# Design kit → app: what is implemented

Source: `Dozari Visual Assets.dc.html` and `Mascot.dc.html` (Candy Arcade v3, exported from Claude Design).
`support.js` is only the design tool's own runtime (`<x-dc>`, `DCLogic`, `dc-import`); the app does not need it.

| Kit section | Status | Where |
|---|---|---|
| Colours: candy light/base/dark, group colours + shelves, ink, cream | done | `apps/mobile/src/theme/colors.ts` |
| Display font Lalezar (bundled via `@expo-google-fonts/lalezar`), body Vazirmatn | done | `App.tsx`, `fonts` in `colors.ts` |
| Line icons (42) | done | `theme/icons.ts`, `components/Icon.tsx` |
| Shelf buttons (light top edge, dark bottom shelf) | done | `components/CandyButton.tsx` |
| Board tiles (cream + shelf, selected grape), solved rows with shelf | done | `components/Board.tsx` |
| Mascot (10 poses, 7 skins, face crop) | done | `theme/mascot.ts`, `components/Mascot.tsx` |
| Splash-style home (wordmark, floating waving mascot, radial backdrop) | done | `home/HomeScreen.tsx`, `Wordmark`, `GradientBackground` |
| Solo result screen mascot (win / sad) | done | `solo/SoloScreen.tsx` |
| Splash screen with loading bar, game-screen backdrop, the hub building scene | todo | |
| Avatars (24), empty/error states | todo | mascot face crop is ready |
| Effects (confetti, rain, twinkle…), banners, tier badges, era stamps | todo | |
| Hub icons (10 portals) | todo | |

The kit page loads Google Fonts at runtime; the app must not (CLAUDE.md rule 8), so fonts are bundled from npm packages.
