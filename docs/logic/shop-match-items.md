# Shop items used inside a duel or table (D226 slice 6)

Owner (2026-10-12): sell an item that shuffles the rival's cards (expensive) and one that shows a group of cards.

| item | effect | default price | level | rule |
|---|---|---|---|---|
| «بُر زدنِ کارتِ حریف» | `shuffle_rival` | 150 coins (the dearest consumable in the shop), ≤ 3 a day | 5 | re-orders the cards still on the rival's board |
| «دیدنِ یک گروه» | `reveal_group` | 60 coins | 3 | shows the four cards of the easiest group the user has not found; the user still has to submit it |

Both are ordinary stockable inventory effects (`user_inventory`, migration 0082): bought in the shop like hint tokens, edited in the admin panel (`/admin/shop`, the effect list has both). Starter rows are topped up by title.

## In a match
- The match takes a snapshot of each player's stock when it starts (`MatchState.itemCounts`, bots get none). `MatchView.items` tells the viewer what is left.
- **Once per kind per player per match** (`SHOP_ITEM_USES_PER_MATCH`), whatever the stock; independent of the one free power-up (magnifier / freeze).
- **Shuffle** works only in separate-boards mode (the old shared board has no «rival's cards»), any time while the rival is not locked out; the service draws the new order with the match rng and the reducer checks it is a permutation. The rival gets a `power {kind:'shuffle'}` event («حریف کارت‌هات رو بر زد») and their local arrangement and selection are dropped. No turn, clock or mistake change.
- **Reveal** works on the user's own turn, captain only; the four ids reach only the user's side (`power` event `itemIds`, stripped for the rival) and are highlighted on the board.
- Socket: `match:power` accepts `shuffle` and `reveal`; those two are async. The command is dry-run first (no side effects), the unit is taken from the inventory with one conditional UPDATE (`consumeMatchItem`, so two uses never spend one unit), then the command is applied; a unit taken for a command that then fails is refunded.

## Not built
Selling the items inside the match screen, gifting them, gem prices, and a spectator view of used items.
