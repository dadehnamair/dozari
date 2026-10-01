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
| Splash (rotating rays, flipping coins, wordmark, mascot, loading bar) | done | `splash/SplashScreen.tsx`, shown 1.8 s after fonts load |
| Avatars (24), tier shields (5), tag pills (12), decade stamps (6) | done | `kit/data.ts`, `Avatar`, `TierBadge`, `TagPill`, `EraStamp` |
| Empty / error states (5), result banners (3) | done | `EmptyState`, `Banner` |
| Hub entrances (10 portals) | done (icons) | `PortalIcon`; the hub screen itself is not built yet |
| Effects: confetti, rain | done | `Confetti`, `Rain`; shown on the solo result screen |
| Effects: twinkle, rings, flicker, pop, drop, shine | todo | keyframes exist in the kit |
| Backgrounds (section B), the home building scene, the search/match screens | todo | |

Dev-only gallery of everything above: the «نمایش طراحی» button on the home screen (`kit/KitGallery.tsx`).

The kit page loads Google Fonts at runtime; the app must not (CLAUDE.md rule 8), so fonts are bundled from npm packages.
