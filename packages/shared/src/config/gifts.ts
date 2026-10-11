/** Small shop gifts between friends (docs/logic/shop.md §Birthday gifts). */

/** A gift is a coin-priced consumable at most this expensive (hint packs and wheel spins). */
export const SHOP_GIFT_MAX_COINS = 100;
/** Item effects that can be given; owned things (cosmetics, shields) cannot. */
export const SHOP_GIFT_EFFECTS = ['hint_token', 'wheel_spin'] as const;
