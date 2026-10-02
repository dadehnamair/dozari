# Visual asset plan

One-page overview image: [`asset-plan.jpg`](asset-plan.jpg) (every box = one file; the number inside is
its pixel size, the caption is its file name without extension). This file is the text version the
code relies on. Direction and palette: `docs/brand-visual.md` (Candy Arcade v3). Motion is done in code
(Reanimated); artists deliver static, transparent, layered files — no video, no runtime downloads, no
Google-hosted anything (CLAUDE.md rule 8).

## Delivery

Drop files into `apps/mobile/assets/<folder>/` with the exact names below. Raster = PNG-24 or WebP with
alpha; vectors = SVG. Pixel sizes are the master (≈@3x) and are scaled down at build time.

| folder | contents |
|---|---|
| `backgrounds/` | `bg-home-{far,mid,near}-{phone,tablet}`, `bg-match-{far,near}-{phone,tablet}`, `bg-queue-loop-{phone,tablet}` (far+near), `bg-win-*`, `bg-lose-*`, `bg-paper-tile` |
| `brand/` | `app-icon`, `icon-android-{fg,bg,mono}`, `icon-notification`, `favicon`, `splash-logo`, `logo-wordmark`, `logo-stacked` |
| `mascot/` | `mascot-{idle,wave,cheer,sad,thinking,shocked,sleeping,pointing}`, `mascot-arm-right`, `mascot-eyes-{open,closed}` |
| `portals/` | `portal-{solo,duel,team,private,daily,ugc-suggest,ugc-vote,leaderboard,achievements,wallet}` |
| `icons/` | `icon-<name>.svg` for the names on the sheet (31 existing + 34 new) |
| `ui/` | 9-slice frames: `tile-{idle,selected,disabled}`, `row-{yellow,green,blue,purple}`, `btn-<color>-{normal,pressed}`, `panel-glass`, `chip`, `badge`, `toast`, `mistake-dot-{full,empty}`, `banner-{vs,win,lose,draw,one-away}` |
| `fx/` | `fx-coin-spin` (8-frame strip), `fx-coin-bit-{1..3}`, `fx-confetti-{1..8}`, `fx-sparkle`, `fx-shine`, `fx-glow`, `fx-ring`, `fx-flame` (6-frame strip), `fx-levelup-rays` |
| `avatars/` | `avatar-01` … `avatar-24` |
| `badges/` | `tier-1` … `tier-5`, `tag-*`, `stamp-era-{dahe50,60,70,80,90,00}` |
| `empty/` | `empty-{no-internet,no-puzzles,no-history,searching,error}` |

## Canvases (portrait only in v1)

| target | master | safe area |
|---|---|---|
| phones (360×640 … 430×932) | 1440×3120 | centre 1440×2560 (9:16 devices lose ~9% top and bottom) |
| tablets (744×1133 … 1024×1366) | 2048×2732 | centre 1700×2732 (narrower tablets lose up to ~17% of the width) |

Backgrounds are drawn edge-to-edge but everything that matters (the 4×4 board area stays nearly empty
in `bg-match`) sits inside the safe area. The base colour/gradient is code; layers are transparent.

## 9-slice insets (at master size)

`tile-*` 96 · `row-*` 48 · `btn-*` 72 · `panel-glass` 96 · `chip`/`badge`/`toast` per file (state the inset in
the file name or a sidecar `.json`).

## Notes

- Icons: 24×24 viewBox, 2 px round stroke, single colour; the app tints them.
- Group colours are fixed: yellow `#F9DF6D`, green `#A0C35A`, blue `#B0C4EF`, purple `#BA81C5`.
- FX sprites are white/neutral so they can be tinted per use.
- Counts (24 avatars, 5 tiers, 12 tags) are starting points and can change; the code reads whatever exists.
