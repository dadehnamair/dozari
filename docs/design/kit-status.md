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
| Opponent search screen + `bg-search` diamond backdrop | done | `search/SearchScreen.tsx`, `DiamondBackground`; reachable from the dev gallery, not wired to matchmaking yet |
| Mascot limbs visible on dark screens (cream halo under the ink strokes) | done | `Mascot` `halo` prop |
| Other backgrounds (section B), the home building scene, the match screen | todo | |

Dev-only gallery of everything above: the «نمایش طراحی» button on the home screen (`kit/KitGallery.tsx`).

The kit page loads Google Fonts at runtime; the app must not (CLAUDE.md rule 8), so fonts are bundled from npm packages.

- New design generation («Dozari - 02 … 11», `Character`, `Scene`; hand-drawn market style, brown ink `#3A2418` on cream `#FBF1DE`):
  - Characters (7, 12 poses, hero's 12 month looks, face crop): done, `components/Character.tsx` + `theme/character*.ts`; used on Home, splash, solo result. The pencil-wobble filter is on for the web; native filter support is unverified, so it is off there (`wobble` prop).
  - Painted backgrounds (bazaar, alley, hojre, caravan, win, dusk): done, `components/Scene.tsx` (+ `SceneBackground`); Home uses the bazaar, the splash the alley. `bg-search` stays the existing diamond; `bg-paper-tile` and the layered parallax export are not built.
  - Brand (03): done. `brand/BrandArt.tsx` draws logo-stacked, logo-wordmark (light bg), app icon, Android adaptive fg/bg/mono, notification and favicon; the dev sheet «برند و آیکن اپ» shows them at export size and `pnpm --filter @dozari/mobile brand:export` (web dev server running, `CHROME_PATH` set) writes the PNGs to `apps/mobile/assets/`, wired in `app.json`. The icon shows the default (male, no-month) hero; a gender/month-specific icon is the D68 follow-up. Native splash image and the notification plugin are not configured.
  - Hub icons (05) and UI icons (06): identical to what was already ported (checked path by path), nothing to do.
  - UI components (07): shelf buttons (ink outline, light top, press), icon button + badge, chip, toast, mistake dots, glass panel, daily-reward card (`DailyRewardCard`, takes the server's steps; not yet wired to login), board tiles/rows with ink outline. The tile `hint` glow and the banner ribbons are unchanged.
  - Item / product icons (12): 57 icons in 6 groups, `components/Item.tsx` + `theme/item-data.ts`, names in `fa.itemGroups`; gallery shows them all.
  - Character motion (the design's `anim`): ported as `components/characterMotion.tsx` + pure keyframes `characterMath.ts` — head bob, breathing torso, blinking, swinging arms (fast when raised), flipping hat coin; on by default for full-body characters, off for face crops (avatars/lists) unless `anim` is passed, and off when the player picks «کمتر حرکت» (reduce motion). One shared clock; only each part's transform re-renders.
  - Female hero `dozariF` (new in the latest `Character.dc.html`): ported. That file no longer has the month looks; ours (from the earlier version) are kept and also apply to `dozariF`.
  - Avatars now follow `09 Avatars - Badges`: a face crop of one of the cast (`Character skin`) on the candy disc, not the coin mascot (D122). Empty states follow `10 Empty States` (`Character` + `skin`, `EmptyNote` for plain empty lists). Still the old candy kit: tier badges, tags, stamps, empty states, banners, fx, icons, buttons, backgrounds. To port from the new files: 08 fx, 09 avatars/badges, 10 empty states, 11 screens (hub, profile, settings, tournament, leaderboard).
