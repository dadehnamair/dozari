repo: dadehnamair/dozari
branch: main
path: docs/design

## Last sync
date: 2026-10-06T10:15:56Z

### Updated in this project
- Adult home rebuilt from apps/mobile/src/home/HomeScreen.tsx (tiles, 3 slab buttons incl. priceOnly)
- Adult hub from apps/mobile/src/hub/{layout,buildings}.ts; adult UI kit from theme/icons.ts
- Split age designs into kids/ and adult/

## Screen map
| Screen | Repo file |
|---|---|
| All DC files | docs/design/*.dc.html (same names at project root) |
| Landing site | docs/design/Dozari Site - *.dc.html, SiteNav, SiteFooter → site/ |
| Yadegar set | docs/design/yadegar/*.dc.html |
| kids/ Banners, adult/ Banner | apps/mobile/src/i18n/fa.ts (ageGroup, guardian) |
| adult/ Login Home (home + hub) | apps/mobile/src/home/HomeScreen.tsx, apps/mobile/src/hub/layout.ts, buildings.ts |
| adult/ UI Kit | apps/mobile/src/theme/icons.ts |

## Sync history
- 2026-10-06T09:38:35Z — read i18n fa.ts; added age banners
- 2026-10-06T09:32:40Z — synced docs/design from main (93 files); added Store Banners v2 and yadegar/
- 2026-10-06T09:26:17Z — initial import from claude/claude-md-skill-plan-9ru1pt (86 files)
