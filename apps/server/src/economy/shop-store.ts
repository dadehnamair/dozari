import { and, asc, eq, gte, ne, shopItems, shopPurchases, shopRealPurchases, sql, userBalances, userCosmetics, userGems, userInventory, wheelSpins } from '@dozari/db';
import type { Db } from '@dozari/db';
import { STREAK_SHIELD_MAX_HELD, STREAK_SHIELD_PRICE } from '@dozari/shared';
import type { CosmeticSlot } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';
import { applyGemEntry } from './gems.js';
import { applyLedgerEntry } from './ledger.js';

export type ShopEffect = 'hint_token' | 'wheel_spin' | 'cosmetic' | 'streak_shield';

export interface ShopItemRow {
  id: string;
  titleFa: string;
  descriptionFa: string;
  effect: ShopEffect;
  amount: number;
  /** Which currency pays for it; the matching price below is the one that counts. */
  currency: 'coins' | 'gems';
  priceCoins: number;
  priceGems: number;
  /** Real-money price in rials; 0 = not for sale for money. */
  priceRials: number;
  skuBazaar: string | null;
  skuMyket: string | null;
  minLevel: number;
  perDayLimit: number;
  /** Slot a `cosmetic` is worn in. */
  slot: CosmeticSlot | null;
  iconKey: string | null;
  sortOrder: number;
  isActive: boolean;
  /** In the daily rotating pool. */
  rotating?: boolean;
}

export type NewShopItem = Omit<ShopItemRow, 'id' | 'sortOrder'>;

export type PurchaseOutcome = { ok: true; balance: number; gems: number; tokens: number } | { ok: false; error: 'insufficient' | 'daily_limit' | 'unavailable' | 'owned' | 'max_held' };
export type PaidOutcome = { ok: true; duplicate: boolean } | { ok: false; error: 'unavailable' | 'owned' };
export type SpendOutcome = { ok: true; paidWith: 'coins' | 'token'; balance: number; tokens: number } | { ok: false; error: 'insufficient' };

/** I/O boundary of the coin shop and the hint payment. Every coin movement goes through the ledger inside one transaction. */
export interface ShopStore {
  items(opts?: { includeHidden?: boolean }): Promise<ShopItemRow[]>;
  item(id: string): Promise<ShopItemRow | null>;
  addItem(item: NewShopItem): Promise<ShopItemRow>;
  updateItem(id: string, patch: Partial<NewShopItem> & { sortOrder?: number }): Promise<'ok' | 'not_found'>;
  wallet(userId: string): Promise<{ balance: number; gems: number; tokens: number; shields?: number }>;
  /** Purchases of one item by this player since `sinceMs`. */
  boughtSince(userId: string, itemId: string, sinceMs: number): Promise<number>;
  /** Buys one item: checks balance and the daily limit, debits coins (`shop_purchase`) and grants the effect, all or nothing. */
  purchase(userId: string, itemId: string, sinceMs: number): Promise<PurchaseOutcome>;
  /** Grants the item of a verified real-money purchase (no coins or gems move); a replayed `(store, orderId)` grants nothing twice. */
  grantPaid(userId: string, itemId: string, store: 'bazaar' | 'myket' | 'bale', orderId: string): Promise<PaidOutcome>;
  /** Cosmetics the player owns: item id → worn. */
  owned(userId: string): Promise<Map<string, boolean>>;
  /** Wears or takes off an owned cosmetic (wearing one takes off the other worn item of its slot). */
  setEquipped(userId: string, itemId: string, equipped: boolean): Promise<'ok' | 'not_owned'>;
  /** Pays for one hint: a hint token if the player has one, else `price` coins (`hint_purchase`). `key` makes a retry a no-op. */
  spendOnHint(userId: string, price: number, key: string): Promise<SpendOutcome>;
}

export const DEFAULT_SHOP_ITEMS: readonly NewShopItem[] = [
  { titleFa: 'یک راهنما', descriptionFa: 'یک بار راهنما گرفتن در بازی تکی، بدون پرداخت سکه در همان لحظه.', effect: 'hint_token', amount: 1, priceCoins: 20, currency: 'coins', priceGems: 0, minLevel: 2, perDayLimit: 0, slot: null, priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'magnifier', isActive: true },
  { titleFa: 'بسته‌ی پنج‌تایی راهنما', descriptionFa: 'پنج راهنما با تخفیف نسبت به خرید تکی.', effect: 'hint_token', amount: 5, priceCoins: 80, currency: 'coins', priceGems: 0, minLevel: 3, perDayLimit: 3, slot: null, priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'potion', isActive: true },
  // Streak shield (economy-v2): saves the daily-reward streak across one missed day; at most STREAK_SHIELD_MAX_HELD held.
  { titleFa: 'سپر استریک', descriptionFa: 'اگر یک روز جایزه‌ی روزانه را جا بیندازی، زنجیره‌ات نمی‌پرد.', effect: 'streak_shield', amount: 1, priceCoins: STREAK_SHIELD_PRICE, currency: 'coins', priceGems: 0, minLevel: 2, perDayLimit: 1, slot: null, priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'umbrella', isActive: true },
  // Higher tiers open further along the level road (docs/logic/progression.md §Level rewards).
  { titleFa: 'بسته‌ی ده‌تایی راهنما', descriptionFa: 'ده راهنما، ارزان‌تر از خرید جدا.', effect: 'hint_token', amount: 10, priceCoins: 150, currency: 'coins', priceGems: 0, minLevel: 10, perDayLimit: 3, slot: null, priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'magnifier', isActive: true },
  { titleFa: 'بسته‌ی بیست‌تایی راهنما', descriptionFa: 'بیست راهنما برای بازی‌های سخت‌تر.', effect: 'hint_token', amount: 20, priceCoins: 280, currency: 'coins', priceGems: 0, minLevel: 20, perDayLimit: 2, slot: null, priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'potion', isActive: true },
  { titleFa: 'صندوق راهنما', descriptionFa: 'پنجاه راهنما؛ مخصوص بازیکن‌های باتجربه.', effect: 'hint_token', amount: 50, priceCoins: 600, currency: 'coins', priceGems: 0, minLevel: 35, perDayLimit: 1, slot: null, priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'chest', isActive: true },
  // Lucky-wheel spins: an average spin pays about 13 coins, so a spin costs more than it returns (a coin sink, but a fun one).
  { titleFa: 'یک چرخش گردونه', descriptionFa: 'یک بار گردونه‌ی شانس را بچرخان؛ شاید سکه‌ی بیشتری برگردد!', effect: 'wheel_spin', amount: 1, priceCoins: 25, currency: 'coins', priceGems: 0, minLevel: 3, perDayLimit: 0, slot: null, priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'dice', isActive: true },
  { titleFa: 'بسته‌ی پنج چرخش گردونه', descriptionFa: 'پنج چرخش گردونه با تخفیف.', effect: 'wheel_spin', amount: 5, priceCoins: 100, currency: 'coins', priceGems: 0, minLevel: 5, perDayLimit: 3, slot: null, priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'gift', isActive: true },
  // Hats and clothing (cosmetics, D165): bought once, worn on the avatar. Prices in coins unless noted; the admin edits all of it.
  { titleFa: 'کلاه شاپو', descriptionFa: 'یک کلاه شاپوی شیک برای آواتارت.', effect: 'cosmetic', amount: 1, priceCoins: 150, currency: 'coins', priceGems: 0, minLevel: 3, perDayLimit: 0, slot: 'hat', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'shapoo', isActive: true },
  { titleFa: 'تاج دوزاری', descriptionFa: 'تاج مخصوص قهرمان‌ها.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 20, minLevel: 5, perDayLimit: 0, slot: 'hat', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'crown', isActive: true },
  { titleFa: 'پیراهن رنگی', descriptionFa: 'یک پیراهن شاد.', effect: 'cosmetic', amount: 1, priceCoins: 200, currency: 'coins', priceGems: 0, minLevel: 4, perDayLimit: 0, slot: 'outfit', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'shirt', isActive: true },
  { titleFa: 'لباس مجلسی', descriptionFa: 'برای روزهای خاص.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 30, minLevel: 8, perDayLimit: 0, slot: 'outfit', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'dress', isActive: true },
  { titleFa: 'کلاه بافتنی', descriptionFa: 'برای روزهای سرد بازار.', effect: 'cosmetic', amount: 1, priceCoins: 100, currency: 'coins', priceGems: 0, minLevel: 2, perDayLimit: 0, slot: 'hat', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'beanie', isActive: true },
  { titleFa: 'موی بلند', descriptionFa: 'یک مدل موی بلند و قهوه‌ای.', effect: 'cosmetic', amount: 1, priceCoins: 180, currency: 'coins', priceGems: 0, minLevel: 3, perDayLimit: 0, slot: 'hair', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'hairLong', isActive: true },
  { titleFa: 'موی فرفری', descriptionFa: 'فرهای پرپشت و شاد.', effect: 'cosmetic', amount: 1, priceCoins: 180, currency: 'coins', priceGems: 0, minLevel: 3, perDayLimit: 0, slot: 'hair', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'hairCurly', isActive: true },
  { titleFa: 'موی بسته', descriptionFa: 'موی جمع‌شده با گیس گوجه‌ای.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 15, minLevel: 6, perDayLimit: 0, slot: 'hair', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'hairBun', isActive: true },
  { titleFa: 'عینک گرد', descriptionFa: 'یک عینک گرد و باوقار.', effect: 'cosmetic', amount: 1, priceCoins: 130, currency: 'coins', priceGems: 0, minLevel: 2, perDayLimit: 0, slot: 'glasses', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'glassesRound', isActive: true },
  { titleFa: 'عینک آفتابی', descriptionFa: 'برای بازیکن‌های خوش‌استایل.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 12, minLevel: 4, perDayLimit: 0, slot: 'glasses', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'glassesSun', isActive: true },
  { titleFa: 'شال گردن', descriptionFa: 'گرم و نوستالژیک.', effect: 'cosmetic', amount: 1, priceCoins: 120, currency: 'coins', priceGems: 0, minLevel: 3, perDayLimit: 0, slot: 'accessory', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'scarf', isActive: true },
  { titleFa: 'دستمال سر', descriptionFa: 'دستمال قرمز خال‌خالی.', effect: 'cosmetic', amount: 1, priceCoins: 90, currency: 'coins', priceGems: 0, minLevel: 2, perDayLimit: 0, slot: 'hat', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'bandana', isActive: true },
  { titleFa: 'کلاه لبه‌دار', descriptionFa: 'یک کلاه لبه‌دار اسپرت.', effect: 'cosmetic', amount: 1, priceCoins: 110, currency: 'coins', priceGems: 0, minLevel: 2, perDayLimit: 0, slot: 'hat', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'cap', isActive: true },
  { titleFa: 'کلاه تولد', descriptionFa: 'برای روزهای جشن.', effect: 'cosmetic', amount: 1, priceCoins: 80, currency: 'coins', priceGems: 0, minLevel: 1, perDayLimit: 0, slot: 'hat', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'partyHat', isActive: true },
  { titleFa: 'کلاه نمدی', descriptionFa: 'کلاه سرخ با منگوله‌ی طلایی.', effect: 'cosmetic', amount: 1, priceCoins: 130, currency: 'coins', priceGems: 0, minLevel: 3, perDayLimit: 0, slot: 'hat', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'fez', isActive: true },
  { titleFa: 'کلاه آشپز', descriptionFa: 'برای استاد غذای حجره.', effect: 'cosmetic', amount: 1, priceCoins: 140, currency: 'coins', priceGems: 0, minLevel: 4, perDayLimit: 0, slot: 'hat', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'chef', isActive: true },
  { titleFa: 'کلاه کابوی', descriptionFa: 'پهن و خاکی.', effect: 'cosmetic', amount: 1, priceCoins: 170, currency: 'coins', priceGems: 0, minLevel: 5, perDayLimit: 0, slot: 'hat', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'cowboy', isActive: true },
  { titleFa: 'کلاه سیلندر', descriptionFa: 'خیلی باکلاس.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 18, minLevel: 6, perDayLimit: 0, slot: 'hat', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'topHat', isActive: true },
  { titleFa: 'کلاه جادوگر', descriptionFa: 'پر از ستاره.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 25, minLevel: 8, perDayLimit: 0, slot: 'hat', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'wizard', isActive: true },
  { titleFa: 'موی سیخ‌سیخی', descriptionFa: 'موی تیز و پرانرژی.', effect: 'cosmetic', amount: 1, priceCoins: 150, currency: 'coins', priceGems: 0, minLevel: 2, perDayLimit: 0, slot: 'hair', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'hairSpiky', isActive: true },
  { titleFa: 'موی کوتاه حالت‌دار', descriptionFa: 'مدل بالای چانه‌ای مرتب.', effect: 'cosmetic', amount: 1, priceCoins: 170, currency: 'coins', priceGems: 0, minLevel: 3, perDayLimit: 0, slot: 'hair', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'hairBob', isActive: true },
  { titleFa: 'موی دم‌اسبی', descriptionFa: 'دم‌اسبی با کش صورتی.', effect: 'cosmetic', amount: 1, priceCoins: 160, currency: 'coins', priceGems: 0, minLevel: 3, perDayLimit: 0, slot: 'hair', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'hairPonytail', isActive: true },
  { titleFa: 'موی آفرو', descriptionFa: 'پرپشت و گرد.', effect: 'cosmetic', amount: 1, priceCoins: 190, currency: 'coins', priceGems: 0, minLevel: 4, perDayLimit: 0, slot: 'hair', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'hairAfro', isActive: true },
  { titleFa: 'موی موهاک', descriptionFa: 'یک خط صورتی وسط سر.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 14, minLevel: 5, perDayLimit: 0, slot: 'hair', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'hairMohawk', isActive: true },
  { titleFa: 'عینک دانشجویی', descriptionFa: 'قاب مربعی برای باهوش‌ها.', effect: 'cosmetic', amount: 1, priceCoins: 120, currency: 'coins', priceGems: 0, minLevel: 2, perDayLimit: 0, slot: 'glasses', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'glassesNerd', isActive: true },
  { titleFa: 'عینک قلبی', descriptionFa: 'دنیا صورتی دیده می‌شود.', effect: 'cosmetic', amount: 1, priceCoins: 140, currency: 'coins', priceGems: 0, minLevel: 3, perDayLimit: 0, slot: 'glasses', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'glassesHeart', isActive: true },
  { titleFa: 'عینک ستاره‌ای', descriptionFa: 'برای ستاره‌ها.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 10, minLevel: 4, perDayLimit: 0, slot: 'glasses', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'glassesStar', isActive: true },
  { titleFa: 'تک‌عینک', descriptionFa: 'با زنجیر طلایی.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 16, minLevel: 7, perDayLimit: 0, slot: 'glasses', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'monocle', isActive: true },
  { titleFa: 'تی‌شرت آبی', descriptionFa: 'تی‌شرت ساده با نشان سکه.', effect: 'cosmetic', amount: 1, priceCoins: 150, currency: 'coins', priceGems: 0, minLevel: 2, perDayLimit: 0, slot: 'outfit', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'tshirt', isActive: true },
  { titleFa: 'پیشبند بقال', descriptionFa: 'مخصوص حجره‌دارها.', effect: 'cosmetic', amount: 1, priceCoins: 160, currency: 'coins', priceGems: 0, minLevel: 3, perDayLimit: 0, slot: 'outfit', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'apron', isActive: true },
  { titleFa: 'هودی', descriptionFa: 'نرم و گرم.', effect: 'cosmetic', amount: 1, priceCoins: 220, currency: 'coins', priceGems: 0, minLevel: 4, perDayLimit: 0, slot: 'outfit', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'hoodie', isActive: true },
  { titleFa: 'پیراهن ورزشی', descriptionFa: 'راه‌راه قرمز و سفید.', effect: 'cosmetic', amount: 1, priceCoins: 200, currency: 'coins', priceGems: 0, minLevel: 4, perDayLimit: 0, slot: 'outfit', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'sportShirt', isActive: true },
  { titleFa: 'قبای قدیمی', descriptionFa: 'قبای شرابی با ریسه‌ی طلایی.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 26, minLevel: 6, perDayLimit: 0, slot: 'outfit', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'ghaba', isActive: true },
  { titleFa: 'کت و شلوار', descriptionFa: 'برای مجلس‌های رسمی.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 28, minLevel: 7, perDayLimit: 0, slot: 'outfit', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'suit', isActive: true },
  { titleFa: 'پاپیون', descriptionFa: 'قرمز و شیک.', effect: 'cosmetic', amount: 1, priceCoins: 110, currency: 'coins', priceGems: 0, minLevel: 3, perDayLimit: 0, slot: 'accessory', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'bowtie', isActive: true },
  { titleFa: 'گردنبند', descriptionFa: 'با نگین آبی.', effect: 'cosmetic', amount: 1, priceCoins: 150, currency: 'coins', priceGems: 0, minLevel: 4, perDayLimit: 0, slot: 'accessory', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'necklace', isActive: true },
  { titleFa: 'مدال قهرمانی', descriptionFa: 'مخصوص برنده‌ها.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 20, minLevel: 6, perDayLimit: 0, slot: 'accessory', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'medal', isActive: true },
  { titleFa: 'شنل', descriptionFa: 'شنل قرمز قهرمان‌ها.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 30, minLevel: 9, perDayLimit: 0, slot: 'accessory', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'cape', isActive: true },
  { titleFa: 'رژگونه', descriptionFa: 'گونه‌های گل‌انداخته.', effect: 'cosmetic', amount: 1, priceCoins: 300, currency: 'coins', priceGems: 0, minLevel: 2, perDayLimit: 0, slot: 'makeup', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'blush', isActive: true },
  { titleFa: 'رژلب صورتی', descriptionFa: 'براق و شاد.', effect: 'cosmetic', amount: 1, priceCoins: 400, currency: 'coins', priceGems: 0, minLevel: 2, perDayLimit: 0, slot: 'makeup', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'lipPink', isActive: true },
  { titleFa: 'خال', descriptionFa: 'یک خال کنار لب.', effect: 'cosmetic', amount: 1, priceCoins: 300, currency: 'coins', priceGems: 0, minLevel: 2, perDayLimit: 0, slot: 'makeup', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'mole', isActive: true },
  { titleFa: 'رژلب قرمز', descriptionFa: 'قرمز کلاسیک.', effect: 'cosmetic', amount: 1, priceCoins: 800, currency: 'coins', priceGems: 0, minLevel: 4, perDayLimit: 0, slot: 'makeup', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'lipRed', isActive: true },
  { titleFa: 'رژلب آلبالویی', descriptionFa: 'تیره و شیک.', effect: 'cosmetic', amount: 1, priceCoins: 800, currency: 'coins', priceGems: 0, minLevel: 4, perDayLimit: 0, slot: 'makeup', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'lipPlum', isActive: true },
  { titleFa: 'سایهٔ بنفش', descriptionFa: 'سایهٔ چشم بنفش.', effect: 'cosmetic', amount: 1, priceCoins: 900, currency: 'coins', priceGems: 0, minLevel: 5, perDayLimit: 0, slot: 'makeup', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'shadowPurple', isActive: true },
  { titleFa: 'خط چشم گربه‌ای', descriptionFa: 'خط چشم کشیده.', effect: 'cosmetic', amount: 1, priceCoins: 1000, currency: 'coins', priceGems: 0, minLevel: 5, perDayLimit: 0, slot: 'makeup', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'liner', isActive: true },
  { titleFa: 'نقاشی قلب', descriptionFa: 'قلب‌های صورتی روی گونه.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 30, minLevel: 6, perDayLimit: 0, slot: 'makeup', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'hearts', isActive: true },
  { titleFa: 'نقاشی ستاره', descriptionFa: 'ستاره‌های آبی روی گونه.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 30, minLevel: 6, perDayLimit: 0, slot: 'makeup', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'stars', isActive: true },
  { titleFa: 'سایهٔ طلایی', descriptionFa: 'سایه‌ی طلایی با ذره‌های درخشان.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 40, minLevel: 8, perDayLimit: 0, slot: 'makeup', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'shadowGold', isActive: true },
  { titleFa: 'اکلیل', descriptionFa: 'اکلیل روی گونه‌ها.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 45, minLevel: 8, perDayLimit: 0, slot: 'makeup', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'glitter', isActive: true },
  { titleFa: 'گریم ببری', descriptionFa: 'خط‌های نارنجی ببری.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 50, minLevel: 9, perDayLimit: 0, slot: 'makeup', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'tiger', isActive: true },
  { titleFa: 'میکاپ کامل', descriptionFa: 'رژگونه، سایه، خط چشم و رژلب یک‌جا.', effect: 'cosmetic', amount: 1, priceCoins: 0, currency: 'gems', priceGems: 90, minLevel: 10, perDayLimit: 0, slot: 'makeup', priceRials: 0, skuBazaar: null, skuMyket: null, iconKey: 'glam', isActive: true },
];

export function createDbShopStore(db: Db): ShopStore {
  let seeded = false;
  const seed = async () => {
    if (seeded) return;
    // Add every default item the table does not have yet (by title), so shops seeded before a tier existed get it too.
    const have = new Set((await db.select({ t: shopItems.titleFa }).from(shopItems)).map((r) => r.t));
    const missing = DEFAULT_SHOP_ITEMS.map((it, i) => ({ it, i })).filter(({ it }) => !have.has(it.titleFa));
    if (missing.length > 0) await db.insert(shopItems).values(missing.map(({ it, i }) => ({ ...it, id: uuidv7(), sortOrder: i })));
    seeded = true;
  };
  const toRow = (r: typeof shopItems.$inferSelect): ShopItemRow => ({ ...r });
  const tokensOf = async (tx: Pick<Db, 'select'>, userId: string): Promise<number> => {
    const [r] = await tx.select({ qty: userInventory.qty }).from(userInventory).where(and(eq(userInventory.userId, userId), eq(userInventory.effect, 'hint_token')));
    return r?.qty ?? 0;
  };
  return {
    async items(opts) {
      await seed();
      const rows = await db.select().from(shopItems).where(opts?.includeHidden ? undefined : eq(shopItems.isActive, true)).orderBy(asc(shopItems.sortOrder));
      return rows.map(toRow);
    },
    async item(id) {
      await seed();
      const [r] = await db.select().from(shopItems).where(eq(shopItems.id, id));
      return r ? toRow(r) : null;
    },
    async addItem(item) {
      await seed();
      const [agg] = await db.select({ top: sql<number>`COALESCE(MAX(${shopItems.sortOrder}), 0)` }).from(shopItems);
      const row = { ...item, id: uuidv7(), sortOrder: Number(agg?.top ?? 0) + 1 };
      await db.insert(shopItems).values(row);
      return row;
    },
    async updateItem(id, patch) {
      const [r] = await db.select({ id: shopItems.id }).from(shopItems).where(eq(shopItems.id, id));
      if (!r) return 'not_found';
      await db.update(shopItems).set(patch).where(eq(shopItems.id, id));
      return 'ok';
    },
    async wallet(userId) {
      const [b] = await db.select({ balance: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId));
      const [g] = await db.select({ balance: userGems.balance }).from(userGems).where(eq(userGems.userId, userId));
      const [sh] = await db.select({ qty: userInventory.qty }).from(userInventory).where(and(eq(userInventory.userId, userId), eq(userInventory.effect, 'streak_shield')));
      return { balance: b?.balance ?? 0, gems: g?.balance ?? 0, tokens: await tokensOf(db, userId), shields: sh?.qty ?? 0 };
    },
    async boughtSince(userId, itemId, sinceMs) {
      const [r] = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(shopPurchases)
        .where(and(eq(shopPurchases.userId, userId), eq(shopPurchases.itemId, itemId), gte(shopPurchases.createdAt, new Date(sinceMs))));
      return Number(r?.n ?? 0);
    },
    async purchase(userId, itemId, sinceMs) {
      await seed();
      return db.transaction(async (tx): Promise<PurchaseOutcome> => {
        const [item] = await tx.select().from(shopItems).where(eq(shopItems.id, itemId));
        if (!item || !item.isActive) return { ok: false, error: 'unavailable' };
        const purchaseId = uuidv7();
        // The ledger call locks this player's balance row first, which also serialises concurrent purchases (so the daily-limit count below is safe).
        const key = `shop_purchase:${purchaseId}:${userId}`;
        const ledger = item.currency === 'gems'
          ? await applyGemEntry(tx, { userId, delta: -item.priceGems, reason: 'shop_purchase', refType: 'shop_item', refId: item.id, idempotencyKey: key })
          : await applyLedgerEntry(tx, { userId, delta: -item.priceCoins, reason: 'shop_purchase', refType: 'shop_item', refId: item.id, idempotencyKey: key });
        if (!ledger.applied) return { ok: false, error: 'insufficient' };
        if (item.perDayLimit > 0) {
          const [c] = await tx
            .select({ n: sql<number>`COUNT(*)` })
            .from(shopPurchases)
            .where(and(eq(shopPurchases.userId, userId), eq(shopPurchases.itemId, itemId), gte(shopPurchases.createdAt, new Date(sinceMs))));
          if (Number(c?.n ?? 0) >= item.perDayLimit) throw new DailyLimit();
        }
        await tx.insert(shopPurchases).values({ id: purchaseId, userId, itemId, priceCoins: item.currency === 'gems' ? 0 : item.priceCoins, priceGems: item.currency === 'gems' ? item.priceGems : 0 });
        if (item.effect === 'cosmetic') {
          // The balance row is locked by the debit above, so two taps cannot both pass this check.
          const [have] = await tx.select({ i: userCosmetics.itemId }).from(userCosmetics).where(and(eq(userCosmetics.userId, userId), eq(userCosmetics.itemId, item.id)));
          if (have) throw new Owned();
          await tx.insert(userCosmetics).values({ userId, itemId: item.id, source: 'shop' });
        } else if (item.effect === 'wheel_spin') {
          // Wheel spins are rows of their own (one per spin), not a counter.
          for (let i = 0; i < item.amount; i++) await tx.insert(wheelSpins).values({ id: uuidv7(), userId, source: 'shop', ref: `${purchaseId}#${i}` });
        } else {
          if (item.effect === 'streak_shield') {
            const [held] = await tx.select({ qty: userInventory.qty }).from(userInventory).where(and(eq(userInventory.userId, userId), eq(userInventory.effect, 'streak_shield')));
            if ((held?.qty ?? 0) + item.amount > STREAK_SHIELD_MAX_HELD) throw new MaxHeld();
          }
          await tx.insert(userInventory).values({ userId, effect: item.effect, qty: item.amount }).onDuplicateKeyUpdate({ set: { qty: sql`${userInventory.qty} + ${item.amount}` } });
        }
        const [coinRow] = await tx.select({ balance: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId));
        const [gemRow] = await tx.select({ balance: userGems.balance }).from(userGems).where(eq(userGems.userId, userId));
        return { ok: true, balance: coinRow?.balance ?? 0, gems: gemRow?.balance ?? 0, tokens: await tokensOf(tx, userId) };
      }).catch((e: unknown) => {
        if (e instanceof DailyLimit) return { ok: false, error: 'daily_limit' } as const;
        if (e instanceof Owned) return { ok: false, error: 'owned' } as const;
        if (e instanceof MaxHeld) return { ok: false, error: 'max_held' } as const;
        throw e;
      });
    },
    async grantPaid(userId, itemId, store, orderId) {
      return db.transaction(async (tx): Promise<PaidOutcome> => {
        const [item] = await tx.select().from(shopItems).where(eq(shopItems.id, itemId));
        if (!item || !item.isActive) return { ok: false, error: 'unavailable' };
        const purchaseId = uuidv7();
        // The unique (store, order id) row is the lock: a replayed callback inserts nothing and grants nothing.
        const [res] = await tx.insert(shopRealPurchases).ignore().values({ id: purchaseId, userId, itemId, store, storeOrderId: orderId, rials: item.priceRials });
        if (res.affectedRows < 1) return { ok: true, duplicate: true };
        if (item.effect === 'cosmetic') {
          const [have] = await tx.select({ i: userCosmetics.itemId }).from(userCosmetics).where(and(eq(userCosmetics.userId, userId), eq(userCosmetics.itemId, item.id)));
          if (have) throw new Owned();
          await tx.insert(userCosmetics).values({ userId, itemId: item.id, source: 'shop' });
        } else if (item.effect === 'wheel_spin') {
          for (let i = 0; i < item.amount; i++) await tx.insert(wheelSpins).values({ id: uuidv7(), userId, source: 'shop', ref: `${purchaseId}#${i}` });
        } else {
          await tx.insert(userInventory).values({ userId, effect: item.effect, qty: item.amount }).onDuplicateKeyUpdate({ set: { qty: sql`${userInventory.qty} + ${item.amount}` } });
        }
        await tx.insert(shopPurchases).values({ id: uuidv7(), userId, itemId, priceCoins: 0, priceGems: 0 });
        return { ok: true, duplicate: false };
      }).catch((e: unknown) => {
        if (e instanceof Owned) return { ok: false, error: 'owned' } as const;
        throw e;
      });
    },
    async owned(userId) {
      const rows = await db.select({ i: userCosmetics.itemId, e: userCosmetics.equipped }).from(userCosmetics).where(eq(userCosmetics.userId, userId));
      return new Map(rows.map((r) => [r.i, r.e]));
    },
    async setEquipped(userId, itemId, equipped) {
      return db.transaction(async (tx) => {
        const [mine] = await tx.select({ slot: shopItems.slot }).from(userCosmetics).innerJoin(shopItems, eq(shopItems.id, userCosmetics.itemId)).where(and(eq(userCosmetics.userId, userId), eq(userCosmetics.itemId, itemId)));
        if (!mine) return 'not_owned';
        if (equipped && mine.slot) {
          const sameSlot = await tx.select({ i: shopItems.id }).from(shopItems).where(and(eq(shopItems.slot, mine.slot), ne(shopItems.id, itemId)));
          for (const o of sameSlot) await tx.update(userCosmetics).set({ equipped: false }).where(and(eq(userCosmetics.userId, userId), eq(userCosmetics.itemId, o.i)));
        }
        await tx.update(userCosmetics).set({ equipped }).where(and(eq(userCosmetics.userId, userId), eq(userCosmetics.itemId, itemId)));
        return 'ok';
      });
    },
    async spendOnHint(userId, price, key) {
      return db.transaction(async (tx): Promise<SpendOutcome> => {
        await tx.insert(userBalances).values({ userId, balance: 0 }).onDuplicateKeyUpdate({ set: { userId: sql`${userBalances.userId}` } });
        // Lock the balance row so a token and a coin payment cannot race.
        const [bal] = await tx.select({ balance: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId)).for('update');
        const tokens = await tokensOf(tx, userId);
        if (tokens > 0) {
          await tx.update(userInventory).set({ qty: sql`${userInventory.qty} - 1` }).where(and(eq(userInventory.userId, userId), eq(userInventory.effect, 'hint_token')));
          return { ok: true, paidWith: 'token', balance: bal?.balance ?? 0, tokens: tokens - 1 };
        }
        if (price === 0) return { ok: true, paidWith: 'coins', balance: bal?.balance ?? 0, tokens: 0 };
        const ledger = await applyLedgerEntry(tx, { userId, delta: -price, reason: 'hint_purchase', refType: 'solo_hint', refId: key, idempotencyKey: `hint_purchase:${key}:${userId}` });
        if (!ledger.applied) return ledger.reason === 'insufficient' ? { ok: false, error: 'insufficient' } : { ok: true, paidWith: 'coins', balance: ledger.balance, tokens: 0 };
        return { ok: true, paidWith: 'coins', balance: ledger.balance, tokens: 0 };
      });
    },
  };
}

class DailyLimit extends Error {}
class Owned extends Error {}
class MaxHeld extends Error {}

/** Memory store for tests: a tiny ledger of balances, tokens and purchases, with the same rules. */
export function createMemoryShopStore(seed: readonly NewShopItem[] = DEFAULT_SHOP_ITEMS): ShopStore & { give(userId: string, coins: number, tokens?: number, gems?: number): void; now: { ms: number }; ledger: { userId: string; delta: number; reason: string }[]; gemLedger: { userId: string; delta: number; reason: string }[] } {
  const rows: ShopItemRow[] = seed.map((s, i) => ({ ...s, id: `00000000-0000-7000-8000-${String(i + 1).padStart(12, '0')}`, sortOrder: i }));
  const balances = new Map<string, number>();
  const tokens = new Map<string, number>();
  const shieldBal = new Map<string, number>();
  const gemBal = new Map<string, number>();
  const wardrobe = new Map<string, Map<string, boolean>>();
  const paidOrders = new Set<string>();
  const bought: { userId: string; itemId: string; at: number }[] = [];
  const keys = new Set<string>();
  const now = { ms: Date.now() };
  const ledger: { userId: string; delta: number; reason: string }[] = [];
  const gemLedger: { userId: string; delta: number; reason: string }[] = [];
  return {
    now,
    ledger,
    gemLedger,
    give(userId, coins, t = 0, g = 0) {
      gemBal.set(userId, (gemBal.get(userId) ?? 0) + g);
      balances.set(userId, (balances.get(userId) ?? 0) + coins);
      tokens.set(userId, (tokens.get(userId) ?? 0) + t);
    },
    async items(opts) {
      return rows.filter((r) => opts?.includeHidden || r.isActive).map((r) => ({ ...r }));
    },
    async item(id) {
      const r = rows.find((x) => x.id === id);
      return r ? { ...r } : null;
    },
    async addItem(item) {
      const row = { ...item, id: `00000000-0000-7000-8000-${String(rows.length + 1).padStart(12, '0')}`, sortOrder: rows.length };
      rows.push(row);
      return { ...row };
    },
    async updateItem(id, patch) {
      const r = rows.find((x) => x.id === id);
      if (!r) return 'not_found';
      Object.assign(r, patch);
      return 'ok';
    },
    async wallet(userId) {
      return { balance: balances.get(userId) ?? 0, gems: gemBal.get(userId) ?? 0, tokens: tokens.get(userId) ?? 0, shields: shieldBal.get(userId) ?? 0 };
    },
    async boughtSince(userId, itemId, since) {
      return bought.filter((b) => b.userId === userId && b.itemId === itemId && b.at >= since).length;
    },
    async purchase(userId, itemId, since) {
      const item = rows.find((r) => r.id === itemId);
      if (!item || !item.isActive) return { ok: false, error: 'unavailable' };
      if (item.perDayLimit > 0 && bought.filter((b) => b.userId === userId && b.itemId === itemId && b.at >= since).length >= item.perDayLimit) return { ok: false, error: 'daily_limit' };
      if (item.effect === 'cosmetic' && wardrobe.get(userId)?.has(item.id)) return { ok: false, error: 'owned' };
      if (item.effect === 'streak_shield' && (shieldBal.get(userId) ?? 0) + item.amount > STREAK_SHIELD_MAX_HELD) return { ok: false, error: 'max_held' };
      if (item.currency === 'gems') {
        const g = gemBal.get(userId) ?? 0;
        if (g < item.priceGems) return { ok: false, error: 'insufficient' };
        gemBal.set(userId, g - item.priceGems);
        gemLedger.push({ userId, delta: -item.priceGems, reason: 'shop_purchase' });
      } else {
        const bal = balances.get(userId) ?? 0;
        if (bal < item.priceCoins) return { ok: false, error: 'insufficient' };
        balances.set(userId, bal - item.priceCoins);
        ledger.push({ userId, delta: -item.priceCoins, reason: 'shop_purchase' });
      }
      if (item.effect === 'cosmetic') wardrobe.set(userId, (wardrobe.get(userId) ?? new Map()).set(item.id, false));
      else if (item.effect === 'streak_shield') shieldBal.set(userId, (shieldBal.get(userId) ?? 0) + item.amount);
      else tokens.set(userId, (tokens.get(userId) ?? 0) + item.amount);
      bought.push({ userId, itemId, at: now.ms });
      return { ok: true, balance: balances.get(userId) ?? 0, gems: gemBal.get(userId) ?? 0, tokens: tokens.get(userId) ?? 0 };
    },
    async grantPaid(userId, itemId, store, orderId) {
      const item = rows.find((r) => r.id === itemId);
      if (!item || !item.isActive) return { ok: false, error: 'unavailable' };
      const key = `${store}:${orderId}`;
      if (paidOrders.has(key)) return { ok: true, duplicate: true };
      if (item.effect === 'cosmetic' && wardrobe.get(userId)?.has(item.id)) return { ok: false, error: 'owned' };
      paidOrders.add(key);
      if (item.effect === 'cosmetic') wardrobe.set(userId, (wardrobe.get(userId) ?? new Map()).set(item.id, false));
      else tokens.set(userId, (tokens.get(userId) ?? 0) + item.amount);
      return { ok: true, duplicate: false };
    },
    async owned(userId) {
      return new Map(wardrobe.get(userId) ?? []);
    },
    async setEquipped(userId, itemId, equipped) {
      const mine = wardrobe.get(userId);
      if (!mine?.has(itemId)) return 'not_owned';
      const slot = rows.find((r) => r.id === itemId)?.slot;
      if (equipped) for (const [other] of mine) if (rows.find((r) => r.id === other)?.slot === slot) mine.set(other, false);
      mine.set(itemId, equipped);
      return 'ok';
    },
    async spendOnHint(userId, price, key) {
      const t = tokens.get(userId) ?? 0;
      if (t > 0) {
        tokens.set(userId, t - 1);
        return { ok: true, paidWith: 'token', balance: balances.get(userId) ?? 0, tokens: t - 1 };
      }
      const bal = balances.get(userId) ?? 0;
      if (keys.has(`${key}:${userId}`)) return { ok: true, paidWith: 'coins', balance: bal, tokens: 0 };
      if (bal < price) return { ok: false, error: 'insufficient' };
      keys.add(`${key}:${userId}`);
      balances.set(userId, bal - price);
      ledger.push({ userId, delta: -price, reason: 'hint_purchase' });
      return { ok: true, paidWith: 'coins', balance: bal - price, tokens: 0 };
    },
  };
}
