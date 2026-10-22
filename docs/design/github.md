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
| adult/ Login Home (home + hub; the gold «قیمت/سوال» tab under the coin plate) | apps/mobile/src/home/HomeScreen.tsx, AdultTopBar.tsx, feedback/SchoolSheet.tsx, apps/mobile/src/hub/layout.ts, buildings.ts |
| adult/ Workshop (the settings page «کارگاه» with the profile card — not the question workshop) | apps/mobile/src/account (settings) |
| adult/ Quiz Duel (topic pick, answering + answer-reveal states) | apps/mobile/src/duel/DuelTriviaRoundAdult.tsx, apps/mobile/src/trivia/TopicPickAdult.tsx, apps/mobile/src/trivia/TriviaSoloAdult.tsx, apps/mobile/src/trivia/TriviaDuelResultAdult.tsx, apps/mobile/src/duel/adultKit.tsx, docs/logic/trivia.md |
| adult/ App Screens (سفره‌خانه، جام‌ها، گنجینه، اتاق پرو، حجرهٔ دوزاری، قهوه‌خانه، اعلان‌ها; 01–02 = Quiz Duel above) | apps/mobile/src/components/PageShell.tsx, GuideBubble.tsx, duel/adultKit.tsx (Pill, Medal), tables/TableSheet.tsx + OpenTables.tsx, tournament/TournamentSheet.tsx, keepsake/TreasuryPage.tsx, wardrobe/FittingRoom.tsx + PackCard.tsx + WardrobeStage.tsx, shop/ShopSheet.tsx, chat/ChatSheet.tsx, inbox/InboxSheet.tsx |
| adult/ UI Kit | apps/mobile/src/theme/icons.ts |
| 13 Match Screens v2 (card faces, backs, 3D flip, motifs) | apps/mobile/src/components/Board.tsx, CardBack.tsx |
| 14 Product Icons | apps/mobile/src/components/Item.tsx |

## Sync history
- 2026-10-06T09:38:35Z — read i18n fa.ts; added age banners
- 2026-10-06T09:32:40Z — synced docs/design from main (93 files); added Store Banners v2 and yadegar/
- 2026-10-06T09:26:17Z — initial import from claude/claude-md-skill-plan-9ru1pt (86 files)
