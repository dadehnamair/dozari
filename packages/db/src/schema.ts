import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  datetime,
  double,
  index,
  int,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import { COSMETIC_SLOTS } from '@dozari/shared/src/economy/slots';
import { AGE_TRACKS, CHAT_MODES, FRIEND_APPROVALS, WORD_TRACKS } from '@dozari/shared/src/config/ageTracks';
import { uuidv7 } from 'uuidv7';

/**
 * Catalog tables so far (docs/PLAN.md): `products`, `product_audiences`, `product_era_tags`,
 * `product_images` and `price_points`, per docs/logic/data-model.md §Catalog. Everything is
 * plain relational columns — no JSON columns (owner decision, docs/DECISIONS.md D63).
 * The rest of the data model lands in later phases as those features are built.
 *
 * MySQL notes: ids are app-generated UUID v7 stored as CHAR(36); timestamps are DATETIME(3)
 * holding UTC (the connection is opened with timezone 'Z', see client.ts).
 */

export const PRODUCT_CATEGORY_VALUES = [
  'car',
  'food',
  'snack',
  'drink',
  'digital',
  'electronics',
  'housing',
  'transport',
  'education',
  'entertainment',
  'clothing',
  'hygiene',
  'service',
  'other',
] as const;

/**
 * Rule kinds (docs/logic/puzzle-generation.md). Duplicated from @dozari/shared on purpose:
 * drizzle-kit loads this file with a CJS loader that cannot resolve the shared package's ESM
 * `.js` imports. A test keeps both lists identical.
 */
export const RULE_KIND_VALUES = [
  'price_band_at_year',
  'same_price_at_year',
  'first_crossed',
  'multiplier_between',
  'cheaper_than_ref',
  'era_icon',
  'category_price_rank',
  'theme_tag',
  'curated',
] as const;

const id = () =>
  char('id', { length: 36 })
    .primaryKey()
    .$defaultFn(() => uuidv7());

const fk = (name: string) => char(name, { length: 36 }).notNull();

const now = () => sql`CURRENT_TIMESTAMP(3)`;

export const products = mysqlTable('products', {
  id: id(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  nameFa: varchar('name_fa', { length: 200 }).notNull(),
  brand: varchar('brand', { length: 200 }),
  category: mysqlEnum('category', PRODUCT_CATEGORY_VALUES).notNull(),
  unitFa: varchar('unit_fa', { length: 100 }),
  /** Key of the hand-drawn icon pack (`ITEM_ICON_KEYS` in shared); null = no icon yet. */
  iconKey: varchar('icon_key', { length: 40 }),
  storyFa: text('story_fa'),
  status: mysqlEnum('status', ['in_production', 'discontinued', 'changed'])
    .notNull()
    .default('in_production'),
  isActive: boolean('is_active').notNull().default(true),
  /** Lowest age track the item is meant for (D198); kid puzzles may only use kid items. */
  ageTrack: mysqlEnum('age_track', AGE_TRACKS).notNull().default('adult'),
  createdBy: char('created_by', { length: 36 }),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 })
    .notNull()
    .default(now())
    .$onUpdate(() => new Date()),
});

/** A child profile held by a guardian (D198, docs/logic/age-tracks.md). One guardian per child; revoking deletes the row. */
export const guardianLinks = mysqlTable(
  'guardian_links',
  {
    childId: fk('child_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    guardianId: fk('guardian_id').references(() => users.id, { onDelete: 'cascade' }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({
    byGuardian: index('guardian_links_guardian_idx').on(table.guardianId),
  }),
);

/** What a guardian chose for one child (docs/logic/age-tracks.md §Guardian panel). One row per child, made on the first save; no row = the open defaults. Plain columns, no JSON (D63). */
export const guardianSettings = mysqlTable('guardian_settings', {
  childId: fk('child_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  chatMode: mysqlEnum('chat_mode', CHAT_MODES).notNull().default('friends_text'),
  friendApproval: mysqlEnum('friend_approval', FRIEND_APPROVALS).notNull().default('auto'),
  duelsEnabled: boolean('duels_enabled').notNull().default(true),
  /** Quiet hours as minutes from midnight (Tehran time); both null = none. A window may cross midnight. */
  quietFrom: smallint('quiet_from'),
  quietTo: smallint('quiet_to'),
  /** Gentle «too much play» reminder after this many minutes in a day; null = off. */
  reminderMinutes: smallint('reminder_minutes'),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
});

/** A guardian blocked a player for one child: they cannot see, befriend or message each other (docs/logic/age-tracks.md §Guardian panel). */
export const guardianBlocks = mysqlTable(
  'guardian_blocks',
  {
    childId: fk('child_id').references(() => users.id, { onDelete: 'cascade' }),
    blockedId: fk('blocked_id').references(() => users.id, { onDelete: 'cascade' }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({ pk: primaryKey({ columns: [table.childId, table.blockedId] }) }),
);

/** Minutes a player was in the app per Tehran day (the guardian's play reminder and digest); filled by a once-a-minute heartbeat from the app. */
export const playMinutes = mysqlTable(
  'play_minutes',
  {
    userId: fk('user_id').references(() => users.id, { onDelete: 'cascade' }),
    dayKey: char('day_key', { length: 10 }).notNull(),
    minutes: smallint('minutes').notNull().default(0),
  },
  (table) => ({ pk: primaryKey({ columns: [table.userId, table.dayKey] }) }),
);

/** A short code a guardian shows so the child's device can sign in as the child: 6 digits, 10 minutes, one use. */
export const guardianLinkCodes = mysqlTable('guardian_link_codes', {
  code: char('code', { length: 6 }).primaryKey(),
  childId: fk('child_id').references(() => users.id, { onDelete: 'cascade' }),
  guardianId: fk('guardian_id').references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
});

/** Which word lessons a player has seen (the guardian's digest «چه چیزی یاد گرفت»): one row per player and item, with the first and last time and how often. */
export const lessonViews = mysqlTable(
  'lesson_views',
  {
    userId: fk('user_id').references(() => users.id, { onDelete: 'cascade' }),
    productId: fk('product_id').references(() => products.id, { onDelete: 'cascade' }),
    firstSeenAt: datetime('first_seen_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    lastSeenAt: datetime('last_seen_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    times: int('times').notNull().default(1),
  },
  (table) => ({ pk: primaryKey({ columns: [table.userId, table.productId] }), byUser: index('lesson_views_user_idx').on(table.userId, table.lastSeenAt) }),
);

/** Kid word lesson of an item (D198): the word, a one-line story and an optional syllable split. Only `approved` lessons are served. */
export const itemLessons = mysqlTable('item_lessons', {
  productId: fk('product_id')
    .primaryKey()
    .references(() => products.id, { onDelete: 'cascade' }),
  wordFa: varchar('word_fa', { length: 60 }).notNull(),
  storyFa: varchar('story_fa', { length: 300 }).notNull().default(''),
  syllablesFa: varchar('syllables_fa', { length: 80 }),
  status: mysqlEnum('status', ['draft', 'approved']).notNull().default('draft'),
  reviewedBy: char('reviewed_by', { length: 36 }),
  reviewedAt: datetime('reviewed_at', { mode: 'date', fsp: 3 }),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 })
    .notNull()
    .default(now())
    .$onUpdate(() => new Date()),
});

/** Who a product resonates with: kids, teens, adults, elderly, family. One row per tag. */
export const productAudiences = mysqlTable(
  'product_audiences',
  {
    productId: fk('product_id').references(() => products.id, { onDelete: 'cascade' }),
    audience: mysqlEnum('audience', ['kids', 'teens', 'adults', 'elderly', 'family']).notNull(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.productId, table.audience] }) }),
);

/** Decade(s) of peak nostalgia, e.g. `dahe-60`. One row per tag. */
export const productEraTags = mysqlTable(
  'product_era_tags',
  {
    productId: fk('product_id').references(() => products.id, { onDelete: 'cascade' }),
    tag: varchar('tag', { length: 50 }).notNull(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.productId, table.tag] }) }),
);

export const productImages = mysqlTable(
  'product_images',
  {
    id: id(),
    productId: fk('product_id').references(() => products.id, { onDelete: 'cascade' }),
    url: varchar('url', { length: 500 }).notNull(),
    yearFrom: smallint('year_from'),
    yearTo: smallint('year_to'),
    isPrimary: boolean('is_primary').notNull().default(false),
    credit: varchar('credit', { length: 300 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({
    productUrl: uniqueIndex('product_images_product_url_idx').on(table.productId, table.url),
  }),
);

export const pricePoints = mysqlTable(
  'price_points',
  {
    id: id(),
    productId: fk('product_id').references(() => products.id, { onDelete: 'cascade' }),
    year: smallint('year').notNull(),
    month: smallint('month'),
    // Rule 2: nominal, integer rials, never inflation-adjusted, never a float.
    priceRials: bigint('price_rials', { mode: 'bigint' }).notNull(),
    sourceType: mysqlEnum('source_type', [
      'archive_newspaper',
      'official_list',
      'receipt_photo',
      'website',
      'user_memory',
      'other',
    ]).notNull(),
    sourceUrl: varchar('source_url', { length: 1000 }),
    sourceNote: text('source_note'),
    confidence: smallint('confidence').notNull(),
    status: mysqlEnum('status', ['approved', 'pending', 'rejected']).notNull().default('pending'),
    // MySQL has no partial unique index: this stored column is 1 for approved rows and NULL
    // otherwise, so UNIQUE(product, year, month_key, approved_flag) only constrains approved rows
    // (NULLs never collide) — matches data-model.md's "unique where status = approved".
    approvedFlag: tinyint('approved_flag').generatedAlwaysAs(
      sql`IF(status = 'approved', 1, NULL)`,
      { mode: 'stored' },
    ),
    // Unique keys treat NULL as distinct, so a month-less point would escape the constraint.
    // This stored column maps a missing month to 0 so "year only" points collide like any other.
    monthKey: smallint('month_key').generatedAlwaysAs(sql`COALESCE(month, 0)`, { mode: 'stored' }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(now())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    approvedUnique: uniqueIndex('price_points_product_year_month_approved_idx').on(
      table.productId,
      table.year,
      table.monthKey,
      table.approvedFlag,
    ),
    byProduct: index('price_points_product_id_idx').on(table.productId),
  }),
);

/**
 * Puzzles (docs/logic/data-model.md §Puzzles). Group rules are stored as flat, typed columns
 * (no JSON, D63): `rule_kind` says which of the nullable `rule_*` columns apply. Convert with
 * `ruleToColumns` / `columnsToRule` (puzzle-rule.ts), which validate through the shared zod schema.
 */
/** Difficulty ladder of whole puzzles, edited in the admin panel; `min_level`..`max_level` is the player-level range a tier is served to (docs/logic/progression.md). */
export const puzzleTiers = mysqlTable('puzzle_tiers', {
  id: id(),
  nameFa: varchar('name_fa', { length: 40 }).notNull(),
  /** Easiest first. */
  sortOrder: int('sort_order').notNull(),
  minLevel: int('min_level').notNull().default(1),
  /** Null = no upper bound. */
  maxLevel: int('max_level'),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
});

export const puzzles = mysqlTable('puzzles', {
  id: id(),
  status: mysqlEnum('status', ['draft', 'approved', 'retired']).notNull().default('draft'),
  source: mysqlEnum('source', ['generated', 'curated', 'ugc']).notNull(),
  authorId: char('author_id', { length: 36 }),
  seed: bigint('seed', { mode: 'bigint' }),
  difficultyScore: double('difficulty_score'),
  /** Tier of the puzzle as a whole; null = not rated yet (served to everyone). */
  tierId: char('tier_id', { length: 36 }),
  /** Which age track's pool the puzzle belongs to (D198). */
  ageTrack: mysqlEnum('age_track', AGE_TRACKS).notNull().default('adult'),
  timesPlayed: int('times_played').notNull().default(0),
  avgSolveRate: double('avg_solve_rate'),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
});

export const puzzleGroups = mysqlTable(
  'puzzle_groups',
  {
    id: id(),
    puzzleId: fk('puzzle_id').references(() => puzzles.id, { onDelete: 'cascade' }),
    /** 0 = yellow (easiest) .. 3 = purple (hardest). */
    level: tinyint('level').notNull(),
    /** Null while a puzzle is a draft; an approved puzzle needs both texts (enforced in code). */
    titleFa: varchar('title_fa', { length: 100 }),
    explanationFa: varchar('explanation_fa', { length: 300 }),
    ruleKind: mysqlEnum('rule_kind', RULE_KIND_VALUES).notNull(),
    ruleYear: smallint('rule_year'),
    ruleYearB: smallint('rule_year_b'),
    ruleMinRials: bigint('rule_min_rials', { mode: 'bigint' }),
    ruleMaxRials: bigint('rule_max_rials', { mode: 'bigint' }),
    ruleTargetRials: bigint('rule_target_rials', { mode: 'bigint' }),
    ruleThresholdRials: bigint('rule_threshold_rials', { mode: 'bigint' }),
    ruleTolerancePct: smallint('rule_tolerance_pct'),
    ruleFromYear: smallint('rule_from_year'),
    ruleToYear: smallint('rule_to_year'),
    ruleMinX: int('rule_min_x'),
    ruleMaxX: int('rule_max_x'),
    ruleRank: smallint('rule_rank'),
    ruleRefProductId: char('rule_ref_product_id', { length: 36 }).references(() => products.id),
    ruleEraTag: varchar('rule_era_tag', { length: 50 }),
    ruleCategory: mysqlEnum('rule_category', PRODUCT_CATEGORY_VALUES),
    ruleNote: varchar('rule_note', { length: 300 }),
  },
  (table) => ({
    levelPerPuzzle: uniqueIndex('puzzle_groups_puzzle_level_idx').on(table.puzzleId, table.level),
  }),
);

/** Exactly 4 per group; `puzzle_id` is denormalised so "16 distinct products per puzzle" is a unique key. */
export const puzzleGroupItems = mysqlTable(
  'puzzle_group_items',
  {
    groupId: fk('group_id').references(() => puzzleGroups.id, { onDelete: 'cascade' }),
    puzzleId: fk('puzzle_id').references(() => puzzles.id, { onDelete: 'cascade' }),
    productId: fk('product_id').references(() => products.id),
    /** Year hint shown on the item card for year-based rules. */
    displayYear: smallint('display_year'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.groupId, table.productId] }),
    distinctProducts: uniqueIndex('puzzle_group_items_puzzle_product_idx').on(table.puzzleId, table.productId),
  }),
);

/** Human/AI-written witty titles matched to a rule kind and level range. */
export const groupTitleTemplates = mysqlTable(
  'group_title_templates',
  {
    id: id(),
    ruleKind: mysqlEnum('rule_kind', RULE_KIND_VALUES).notNull(),
    titleFa: varchar('title_fa', { length: 100 }).notNull(),
    tone: mysqlEnum('tone', ['funny', 'nostalgic', 'neutral']).notNull().default('funny'),
    minLevel: tinyint('min_level').notNull().default(0),
    maxLevel: tinyint('max_level').notNull().default(3),
    isActive: boolean('is_active').notNull().default(true),
    /** How often a human picked this draft for a real puzzle (reuse good ones, drop bad ones). */
    timesChosen: int('times_chosen').notNull().default(0),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({
    byKind: index('group_title_templates_kind_idx').on(table.ruleKind, table.isActive),
  }),
);

/**
 * Players (docs/logic/data-model.md §Users). A guest account is created from a device id on first open;
 * phone linking, chat unlock and invites arrive with their phases.
 */
export const users = mysqlTable(
  'users',
  {
    id: id(),
    deviceId: varchar('device_id', { length: 64 }),
    nickname: varchar('nickname', { length: 60 }).notNull(),
    avatarKey: varchar('avatar_key', { length: 30 }).notNull(),
    isBanned: boolean('is_banned').notNull().default(false),
    /** Optional, picked from a fixed list (D68); switches the hero character. Never shown publicly. */
    gender: mysqlEnum('gender', ['female', 'male']),
    /** Solar Hijri birth date (D160), all three set or all null; never sent to other players. */
    birthYear: smallint('birth_year'),
    birthMonth: tinyint('birth_month'),
    birthDay: tinyint('birth_day'),
    /** Others may see the age (whole years) on the public profile; default off. */
    showAge: boolean('show_age').notNull().default(false),
    /** Friends get an inbox message when the birthday week starts and on the day; default on. */
    notifyBirthday: boolean('notify_birthday').notNull().default(true),
    /** Set when the player redeems an invite code: it activates free chat, renaming and gifts (chat-and-access.md). */
    chatUnlockedAt: datetime('chat_unlocked_at', { mode: 'date', fsp: 3 }),
    /** Home city (a row of `cities`), optional; shown on the profile and used for the city room. */
    cityId: char('city_id', { length: 36 }),
    /** INTERNAL: an account the game plays itself (docs/logic/bots.md). Never in any player-facing response or socket payload. */
    isBot: boolean('is_bot').notNull().default(false),
    /** The badge shown next to the name (one of the player's earned badges). */
    equippedBadgeId: char('equipped_badge_id', { length: 36 }),
    /** Public ID others can search for (exact match). */
    handle: varchar('handle', { length: 12 }),
    /** May a player who knows my verified phone number find me? Default yes; never shows the number. */
    findableByPhone: boolean('findable_by_phone').notNull().default(true),
    /** Verified mobile number as +989XXXXXXXXX (unique). Set only after Bale contact or SMS verification. */
    phone: varchar('phone', { length: 16 }),
    phonePending: varchar('phone_pending', { length: 16 }),
    phoneVerifiedAt: datetime('phone_verified_at', { mode: 'date', fsp: 3 }),
    /** Optional contact e-mail; private and not verified yet. */
    email: varchar('email', { length: 120 }),
    /** Chosen age track (D198), never computed from the birth date; adult for every existing account. */
    ageTrack: mysqlEnum('age_track', AGE_TRACKS).notNull().default('adult'),
    /** When the player picked a track; null = not asked yet, so the chooser shows once. */
    ageTrackSetAt: datetime('age_track_set_at', { mode: 'date', fsp: 3 }),
    /** Why and when an admin banned the player. */
    banReason: varchar('ban_reason', { length: 200 }),
    bannedAt: datetime('banned_at', { mode: 'date', fsp: 3 }),
    /** Tokens issued before this moment are refused ("log out everywhere", bans). */
    sessionsValidAfter: datetime('sessions_valid_after', { mode: 'date', fsp: 3 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    lastSeenAt: datetime('last_seen_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({
    deviceUnique: uniqueIndex('users_device_id_idx').on(table.deviceId),
    phoneUnique: uniqueIndex('users_phone_idx').on(table.phone),
    handleUnique: uniqueIndex('users_handle_idx').on(table.handle),
  }),
);

/** The app the player used last (platform, OS and app version, market) plus where it was first seen: the install source. One row per account. */
export const userClients = mysqlTable('user_clients', {
  userId: char('user_id', { length: 36 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  platform: varchar('platform', { length: 12 }).notNull(),
  osVersion: varchar('os_version', { length: 24 }),
  appBuild: int('app_build'),
  /** Market of the build in use now (`myket`, `bazaar`, `bale`), empty for web and development builds. */
  store: varchar('store', { length: 12 }),
  /** The market of the first build seen for this account. */
  firstStore: varchar('first_store', { length: 12 }),
  firstBuild: int('first_build'),
  firstSeenAt: datetime('first_seen_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
});

/** Why coins moved (docs/logic/economy.md, data-model.md §Economy). */
export const LEDGER_REASONS = [
  'signup_bonus',
  'daily_login',
  'match_entry',
  'match_payout',
  'match_refund',
  'invite_reward',
  'ugc_reward',
  'admin_adjust',
  'purchase',
  'bot_match_subsidy',
  'price_guess_wager',
  'price_guess_payout',
  'shop_purchase',
  'hint_purchase',
  'gift_out',
  'gift_in',
  'loan_out',
  'loan_in',
  'repay_out',
  'repay_in',
  'daily_puzzle',
  'tournament_entry',
  'tournament_refund',
  'tournament_prize',
  'match_consolation',
  'broke_rescue',
  'wheel_spin',
  'level_reward',
  'profile_task',
  'birthday_gift',
  'keepsake_piece',
  'keepsake_upgrade',
] as const;

/** Append-only. Coins move only through the server's ledger function; a repeated idempotency key is a no-op. */
export const coinLedger = mysqlTable(
  'coin_ledger',
  {
    id: id(),
    userId: fk('user_id').references(() => users.id),
    delta: int('delta').notNull(),
    reason: mysqlEnum('reason', LEDGER_REASONS).notNull(),
    refType: varchar('ref_type', { length: 30 }),
    refId: varchar('ref_id', { length: 64 }),
    idempotencyKey: varchar('idempotency_key', { length: 150 }).notNull(),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({
    keyUnique: uniqueIndex('coin_ledger_idempotency_key_idx').on(table.idempotencyKey),
    byUser: index('coin_ledger_user_idx').on(table.userId, table.createdAt),
  }),
);

/** Cached balance, updated in the same transaction as the ledger row (balance = SUM(delta), never negative). */
export const userBalances = mysqlTable('user_balances', {
  userId: char('user_id', { length: 36 }).primaryKey().references(() => users.id),
  balance: int('balance').notNull().default(0),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
});

/** Why gems moved (docs/logic/economy.md §Gems, D164). */
export const GEM_REASONS = ['admin_adjust', 'birthday_gift', 'wheel_prize', 'shop_purchase', 'tournament_entry', 'tournament_refund', 'tournament_prize', 'mission_reward', 'keepsake_reward'] as const;

/** Cached gem balance per player; changed only together with a `gem_ledger` row. */
export const userGems = mysqlTable('user_gems', {
  userId: char('user_id', { length: 36 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  balance: int('balance').notNull().default(0),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
});

/** Append-only gem movements, like `coin_ledger`: a repeated idempotency key is a no-op. */
export const gemLedger = mysqlTable(
  'gem_ledger',
  {
    id: id(),
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    delta: int('delta').notNull(),
    reason: mysqlEnum('reason', GEM_REASONS).notNull(),
    refType: varchar('ref_type', { length: 30 }),
    refId: varchar('ref_id', { length: 64 }),
    idempotencyKey: varchar('idempotency_key', { length: 150 }).notNull(),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({
    keyUnique: uniqueIndex('gem_ledger_idempotency_key_idx').on(table.idempotencyKey),
    byUser: index('gem_ledger_user_idx').on(table.userId, table.createdAt),
  }),
);

/** Admin-editable coins per streak day (day 1, 2, 3 …). Empty table = the defaults in shared config. */
export const dailyRewardSteps = mysqlTable('daily_reward_steps', {
  day: smallint('day').primaryKey(),
  coins: int('coins').notNull(),
});

/** Per-player daily reward state: when they last claimed and which streak day that was. */
export const userDailyRewards = mysqlTable('user_daily_rewards', {
  userId: char('user_id', { length: 36 }).primaryKey().references(() => users.id),
  lastClaimedAt: datetime('last_claimed_at', { mode: 'date', fsp: 3 }).notNull(),
  streakDay: smallint('streak_day').notNull(),
  claimsTotal: int('claims_total').notNull().default(0),
});

/** Admin-editable overrides of the tunables in shared config (the registry lives in `config/registry.ts`). Missing key = default. */
export const appSettings = mysqlTable('app_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: varchar('value', { length: 500 }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 })
    .notNull()
    .default(now())
    .$onUpdate(() => new Date()),
});

/** Append-only trail of what the admin changed (settings, prices, products, users, bot decisions). */
export const adminAuditLog = mysqlTable(
  'admin_audit_log',
  {
    id: id(),
    at: datetime('at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    action: varchar('action', { length: 60 }).notNull(),
    /** Which admin account did it (the display name at that time); null for rows written before accounts existed. */
    actor: varchar('actor', { length: 60 }),
    target: varchar('target', { length: 200 }).notNull(),
    detail: text('detail'),
  },
  (table) => ({ byTime: index('admin_audit_log_at_idx').on(table.at) }),
);

/** A player's Bale chat, linked with a one-time code typed to the bot. `dailyNotifiedFor` = the claim time we already announced the next daily reward for. */
export const baleLinks = mysqlTable(
  'bale_links',
  {
    userId: char('user_id', { length: 36 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    chatId: varchar('chat_id', { length: 40 }).notNull(),
    linkedAt: datetime('linked_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    dailyNotifiedFor: datetime('daily_notified_for', { mode: 'date', fsp: 3 }),
  },
  (table) => ({ uniqChat: uniqueIndex('bale_links_chat_uq').on(table.chatId) }),
);

export const baleLinkCodes = mysqlTable('bale_link_codes', {
  code: varchar('code', { length: 12 }).primaryKey(),
  userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
});

/** Private notes admins keep about a player (moderation history). */
export const userNotes = mysqlTable(
  'user_notes',
  {
    id: id(),
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    note: varchar('note', { length: 500 }).notNull(),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({ byUser: index('user_notes_user_idx').on(table.userId, table.createdAt) }),
);

export const FRIENDSHIP_STATUSES = ['pending', 'accepted'] as const;

/** One row per pair of players; the ids are stored in sorted order so a pair can exist only once. */
export const friendships = mysqlTable(
  'friendships',
  {
    userLow: char('user_low', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    userHigh: char('user_high', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    requestedBy: char('requested_by', { length: 36 }).notNull(),
    status: mysqlEnum('status', FRIENDSHIP_STATUSES).notNull().default('pending'),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    respondedAt: datetime('responded_at', { mode: 'date', fsp: 3 }),
  },
  (table) => ({ pk: primaryKey({ columns: [table.userLow, table.userHigh] }), byHigh: index('friendships_high_idx').on(table.userHigh) }),
);

/** `all` and `bale_linked` reach adults only; `kid` and `teen` are the deliberate, child-safe audiences (docs/logic/age-tracks.md §Admin panel). */
export const MESSAGE_AUDIENCES = ['all', 'bale_linked', 'user', 'kid', 'teen'] as const;
export const MESSAGE_CHANNELS = ['in_app', 'bale', 'sms', 'email', 'push'] as const;

/** A message the admin sent from the message center (one row per send); `retractedAt` hides it from players' inboxes. */
export const adminMessages = mysqlTable(
  'admin_messages',
  {
    id: id(),
    title: varchar('title', { length: 150 }).notNull(),
    body: text('body').notNull(),
    audience: mysqlEnum('audience', MESSAGE_AUDIENCES).notNull(),
    targetUserId: char('target_user_id', { length: 36 }),
    /** A player this message is about (a friend's birthday): tapping the message in the inbox opens their profile. */
    linkUserId: char('link_user_id', { length: 36 }),
    sentAt: datetime('sent_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    retractedAt: datetime('retracted_at', { mode: 'date', fsp: 3 }),
  },
  (table) => ({ bySent: index('admin_messages_sent_idx').on(table.sentAt) }),
);

/** Which channels a message went out on and how many recipients each reached (a table, not an array column). */
export const adminMessageChannels = mysqlTable(
  'admin_message_channels',
  {
    messageId: char('message_id', { length: 36 }).notNull().references(() => adminMessages.id, { onDelete: 'cascade' }),
    channel: mysqlEnum('channel', MESSAGE_CHANNELS).notNull(),
    recipients: int('recipients').notNull().default(0),
  },
  (table) => ({ pk: primaryKey({ columns: [table.messageId, table.channel] }) }),
);

/** The in-app inbox: one row per player per message. */
export const inboxMessages = mysqlTable(
  'inbox_messages',
  {
    id: id(),
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    messageId: char('message_id', { length: 36 }).notNull().references(() => adminMessages.id, { onDelete: 'cascade' }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    readAt: datetime('read_at', { mode: 'date', fsp: 3 }),
  },
  (table) => ({ byUser: index('inbox_messages_user_idx').on(table.userId, table.createdAt) }),
);

export const OUTBOX_STATUSES = ['pending', 'sent', 'failed'] as const;

/** Everything the game wants to tell a player (or the admin chat) on Bale; the dispatcher sends it and records the outcome. */
export const notificationOutbox = mysqlTable(
  'notification_outbox',
  {
    id: id(),
    chatId: varchar('chat_id', { length: 40 }).notNull(),
    userId: char('user_id', { length: 36 }),
    kind: varchar('kind', { length: 40 }).notNull(),
    text: text('text').notNull(),
    status: mysqlEnum('status', OUTBOX_STATUSES).notNull().default('pending'),
    attempts: smallint('attempts').notNull().default(0),
    lastError: varchar('last_error', { length: 300 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    sentAt: datetime('sent_at', { mode: 'date', fsp: 3 }),
  },
  (table) => ({ byStatus: index('notification_outbox_status_idx').on(table.status, table.createdAt) }),
);

export const WORD_SEVERITIES = ['block', 'mask'] as const;

/** The profanity list (D69), editable from the admin panel. `word` is stored as typed; matching normalises both sides. */
export const blockedWords = mysqlTable(
  'blocked_words',
  {
    id: id(),
    word: varchar('word', { length: 100 }).notNull(),
    severity: mysqlEnum('severity', WORD_SEVERITIES).notNull().default('block'),
    /** `kid_teen` words apply only to kid and teen readers (the stricter list, docs/logic/age-tracks.md). */
    track: mysqlEnum('track', WORD_TRACKS).notNull().default('all'),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({ uniqWord: uniqueIndex('blocked_words_word_uq').on(table.word) }),
);

export const ADMIN_ROLES = ['owner', 'editor', 'support', 'viewer'] as const;

/** Admin panel accounts. The password is stored as a salted scrypt hash, never in clear. */
export const adminUsers = mysqlTable(
  'admin_users',
  {
    id: id(),
    username: varchar('username', { length: 30 }).notNull(),
    displayName: varchar('display_name', { length: 60 }).notNull(),
    passwordHash: varchar('password_hash', { length: 200 }).notNull(),
    role: mysqlEnum('role', ADMIN_ROLES).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    failedLogins: smallint('failed_logins').notNull().default(0),
    lockedUntil: datetime('locked_until', { mode: 'date', fsp: 3 }),
    /** Bumped on a password change or deactivation: sessions signed with an older value stop working. */
    sessionVersion: int('session_version').notNull().default(1),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    lastLoginAt: datetime('last_login_at', { mode: 'date', fsp: 3 }),
  },
  (table) => ({ uniqUsername: uniqueIndex('admin_users_username_uq').on(table.username) }),
);

export const BOT_ADAPTERS = ['html_table', 'csv', 'text_lines'] as const;

/** Where the content bot looks (docs/logic/content-bot.md). `adapter` picks a built-in parser; its options are rows of `content_source_options`. */
export const contentSources = mysqlTable('content_sources', {
  id: id(),
  name: varchar('name', { length: 150 }).notNull(),
  url: varchar('url', { length: 1000 }).notNull(),
  adapter: mysqlEnum('adapter', BOT_ADAPTERS).notNull(),
  /** Stored on each candidate's price point as its source type. */
  sourceType: mysqlEnum('source_type', [
    'archive_newspaper',
    'official_list',
    'receipt_photo',
    'website',
    'user_memory',
    'other',
  ])
    .notNull()
    .default('website'),
  enabled: boolean('enabled').notNull().default(true),
  /** Run again when this many hours passed since the last run. */
  everyHours: smallint('every_hours').notNull().default(24),
  lastRunAt: datetime('last_run_at', { mode: 'date', fsp: 3 }),
  notes: text('notes'),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
});

/** Key/value options of a source's adapter (column indexes, year column, units ...): one row per option, no JSON. */
export const contentSourceOptions = mysqlTable(
  'content_source_options',
  {
    sourceId: fk('source_id').references(() => contentSources.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 60 }).notNull(),
    value: varchar('value', { length: 500 }).notNull(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.sourceId, table.key] }) }),
);

export const botRuns = mysqlTable(
  'bot_runs',
  {
    id: id(),
    sourceId: char('source_id', { length: 36 }),
    startedAt: datetime('started_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    finishedAt: datetime('finished_at', { mode: 'date', fsp: 3 }),
    status: mysqlEnum('status', ['running', 'ok', 'failed']).notNull().default('running'),
    foundCount: int('found_count').notNull().default(0),
    newCount: int('new_count').notNull().default(0),
    errorText: text('error_text'),
  },
  (table) => ({ byStart: index('bot_runs_started_idx').on(table.startedAt) }),
);

/**
 * Something the bot found that a human has to decide on. Always starts `pending`; approving it creates the price point
 * (and the product, if it is new). The bot never writes `price_points` itself (rule: no invented approved prices).
 */
export const priceCandidates = mysqlTable(
  'price_candidates',
  {
    id: id(),
    runId: char('run_id', { length: 36 }),
    sourceId: char('source_id', { length: 36 }),
    productNameFa: varchar('product_name_fa', { length: 200 }).notNull(),
    unitFa: varchar('unit_fa', { length: 100 }),
    categoryGuess: mysqlEnum('category_guess', PRODUCT_CATEGORY_VALUES),
    /** Matched catalog product, if the name is already known. */
    productId: char('product_id', { length: 36 }),
    year: smallint('year').notNull(),
    month: smallint('month'),
    priceRials: bigint('price_rials', { mode: 'bigint' }).notNull(),
    sourceUrl: varchar('source_url', { length: 1000 }).notNull(),
    excerpt: text('excerpt'),
    confidence: smallint('confidence').notNull().default(2),
    status: mysqlEnum('status', ['pending', 'approved', 'rejected']).notNull().default('pending'),
    /** Same (name, year, month, price, url) is only stored once. */
    dedupeKey: varchar('dedupe_key', { length: 64 }).notNull(),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    reviewedAt: datetime('reviewed_at', { mode: 'date', fsp: 3 }),
  },
  (table) => ({
    dedupe: uniqueIndex('price_candidates_dedupe_idx').on(table.dedupeKey),
    byStatus: index('price_candidates_status_idx').on(table.status, table.createdAt),
  }),
);

/** Cities a player can pick (docs/logic/owner-backlog-2026-10.md item 8). Seeded from the shared default list, editable in the admin panel. */
export const cities = mysqlTable(
  'cities',
  {
    id: id(),
    slug: varchar('slug', { length: 40 }).notNull(),
    nameFa: varchar('name_fa', { length: 60 }).notNull(),
    /** Key into shared `PROVINCES` (D101); null = no regional identity («شهر دیگر»). */
    province: varchar('province', { length: 24 }),
    /** The city's own souvenir (admin-written); null = the province's default one. */
    souvenirFa: varchar('souvenir_fa', { length: 60 }),
    /** Short slogan shown on Home for players of this city; null = none. */
    sloganFa: varchar('slogan_fa', { length: 120 }),
    sortOrder: int('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => ({ slugUnique: uniqueIndex('cities_slug_idx').on(table.slug) }),
);

/** One row per finished game's XP, so the week / month leaderboards can sum a time window (totals live in `user_stats`). */
export const xpEvents = mysqlTable(
  'xp_events',
  {
    id: id(),
    userId: fk('user_id').references(() => users.id),
    xp: int('xp').notNull(),
    /** What the game was and how it ended, for «بازی‌های اخیر» (null on rows written before the history existed). */
    mode: mysqlEnum('mode', ['solo', 'duel']),
    outcome: mysqlEnum('outcome', ['win', 'loss', 'draw']),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({
    byTime: index('xp_events_time_idx').on(table.createdAt, table.userId),
    byUser: index('xp_events_user_idx').on(table.userId, table.createdAt),
  }),
);

/** Running totals of a player's finished games and experience; level is computed from `xp`, never stored. */
export const userStats = mysqlTable('user_stats', {
  userId: char('user_id', { length: 36 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  xp: int('xp').notNull().default(0),
  games: int('games').notNull().default(0),
  wins: int('wins').notNull().default(0),
  losses: int('losses').notNull().default(0),
  draws: int('draws').notNull().default(0),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
});

/** What a shop item gives. `cosmetic` is a hat / clothing item the player keeps and wears (no stock). */
export const SHOP_EFFECTS = ['hint_token', 'wheel_spin', 'cosmetic', 'streak_shield'] as const;
/** Stockable effects of `user_inventory` (a cosmetic is owned in `user_cosmetics`, not counted). */
export const INVENTORY_EFFECTS = ['hint_token', 'wheel_spin', 'streak_shield'] as const;

/** Things a player can buy with coins (docs/logic/shop.md). Prices, level gates and daily limits are edited in the admin panel. */
export const shopItems = mysqlTable(
  'shop_items',
  {
    id: id(),
    titleFa: varchar('title_fa', { length: 80 }).notNull(),
    descriptionFa: varchar('description_fa', { length: 300 }).notNull().default(''),
    effect: mysqlEnum('effect', SHOP_EFFECTS).notNull(),
    /** Units of the effect one purchase grants. */
    amount: int('amount').notNull().default(1),
    /** Which currency pays for it (`price_coins` or `price_gems` is the one that counts). */
    currency: mysqlEnum('currency', ['coins', 'gems']).notNull().default('coins'),
    priceCoins: int('price_coins').notNull(),
    priceGems: int('price_gems').notNull().default(0),
    /** Real-money price in rials (0 = not sold for money); paid through Bale or a store receipt (D170). */
    priceRials: bigint('price_rials', { mode: 'number' }).notNull().default(0),
    skuBazaar: varchar('sku_bazaar', { length: 80 }),
    skuMyket: varchar('sku_myket', { length: 80 }),
    minLevel: int('min_level').notNull().default(1),
    /** 0 = no daily limit. */
    perDayLimit: int('per_day_limit').notNull().default(0),
    /** Slot a `cosmetic` item is worn in (one worn item per slot); null for other effects. */
    slot: mysqlEnum('slot', COSMETIC_SLOTS),
    iconKey: varchar('icon_key', { length: 30 }),
    sortOrder: int('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    /** Part of the daily rotating pool: only `shop.daily_slots` of the rotating items are on offer each Tehran day. */
    rotating: boolean('rotating').notNull().default(false),
  },
  (table) => ({ bySort: index('shop_items_sort_idx').on(table.sortOrder) }),
);

/** One verified real-money purchase of a shop item; the unique order id makes a replayed callback harmless (D170). */
export const shopRealPurchases = mysqlTable(
  'shop_real_purchases',
  {
    id: id(),
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    itemId: char('item_id', { length: 36 }).notNull().references(() => shopItems.id),
    store: mysqlEnum('store', ['bazaar', 'myket', 'bale']).notNull(),
    storeOrderId: varchar('store_order_id', { length: 120 }).notNull(),
    rials: bigint('rials', { mode: 'number' }).notNull(),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({ orderUnique: uniqueIndex('shop_real_purchases_order_idx').on(table.store, table.storeOrderId) }),
);

/** Cosmetic shop items a player owns (bought, or won on the wheel), and which of them are worn. */
export const userCosmetics = mysqlTable(
  'user_cosmetics',
  {
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    itemId: char('item_id', { length: 36 }).notNull().references(() => shopItems.id),
    equipped: boolean('equipped').notNull().default(false),
    source: varchar('source', { length: 16 }).notNull().default('shop'),
    acquiredAt: datetime('acquired_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({ pk: primaryKey({ columns: [table.userId, table.itemId] }) }),
);

/** Keepsake rarity; a copy of `KEEPSAKE_RARITIES` in shared (drizzle-kit cannot load the shared ESM config), a server test keeps them equal. */
export const KEEPSAKE_RARITY_VALUES = ['common', 'rare', 'epic', 'legendary'] as const;

/** A group of keepsakes («مجموعه»): completing every active keepsake of it pays `reward_gems` once (docs/logic/economy-v2.md). */
export const keepsakeSets = mysqlTable('keepsake_sets', {
  id: id(),
  titleFa: varchar('title_fa', { length: 120 }).notNull(),
  rewardGems: int('reward_gems').notNull().default(10),
  sortOrder: int('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

/** One collectible product-in-an-era, bought piece by piece («یادگار»). The art is supplied by the owner's designer through `art_key`. */
export const keepsakeDefs = mysqlTable(
  'keepsake_defs',
  {
    id: id(),
    /** The catalog product it is made from (its icon and story are the fallback); null = a free-standing keepsake. */
    productId: char('product_id', { length: 36 }).references(() => products.id),
    titleFa: varchar('title_fa', { length: 120 }).notNull(),
    storyFa: text('story_fa').notNull(),
    /** Solar Hijri year of the era it recalls. */
    eraYear: int('era_year'),
    rarity: mysqlEnum('rarity', KEEPSAKE_RARITY_VALUES).notNull().default('common'),
    pieces: int('pieces').notNull().default(4),
    artKey: varchar('art_key', { length: 60 }),
    setId: char('set_id', { length: 36 }).references(() => keepsakeSets.id),
    rewardGems: int('reward_gems').notNull().default(3),
    sortOrder: int('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({ bySet: index('keepsake_defs_set_idx').on(table.setId) }),
);

/** Pieces a player owns (one row per piece; a drop or a purchase is always a missing piece, so there are no duplicates). `ref` makes a grant idempotent. */
export const userKeepsakePieces = mysqlTable(
  'user_keepsake_pieces',
  {
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    keepsakeId: char('keepsake_id', { length: 36 }).notNull().references(() => keepsakeDefs.id),
    piece: int('piece').notNull(),
    source: mysqlEnum('source', ['drop', 'shop', 'admin']).notNull(),
    ref: varchar('ref', { length: 100 }).notNull(),
    acquiredAt: datetime('acquired_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.keepsakeId, table.piece] }),
    refUnique: uniqueIndex('user_keepsake_pieces_ref_idx').on(table.userId, table.ref),
  }),
);

/** A completed keepsake: its upgrade level (frame tier) and its place on the profile showcase (1..6, null = not pinned). */
export const userKeepsakes = mysqlTable(
  'user_keepsakes',
  {
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    keepsakeId: char('keepsake_id', { length: 36 }).notNull().references(() => keepsakeDefs.id),
    level: int('level').notNull().default(1),
    showcaseSlot: int('showcase_slot'),
    completedAt: datetime('completed_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({ pk: primaryKey({ columns: [table.userId, table.keepsakeId] }) }),
);

/** A completed set, so its gem reward is paid once. */
export const userKeepsakeSets = mysqlTable(
  'user_keepsake_sets',
  {
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    setId: char('set_id', { length: 36 }).notNull().references(() => keepsakeSets.id),
    completedAt: datetime('completed_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({ pk: primaryKey({ columns: [table.userId, table.setId] }) }),
);

/** Fixed coin packages sold for real money through a store (built, switched off by `feature.coin_packages`). */
export const coinPackages = mysqlTable(
  'coin_packages',
  {
    id: id(),
    titleFa: varchar('title_fa', { length: 80 }).notNull(),
    coins: int('coins').notNull(),
    /** Price in rials (display only; the store charges its own price for the SKU). */
    priceRials: bigint('price_rials', { mode: 'bigint' }).notNull(),
    skuBazaar: varchar('sku_bazaar', { length: 80 }),
    skuMyket: varchar('sku_myket', { length: 80 }),
    /** Buying needs this player level (paid items unlock at a level). */
    minLevel: int('min_level').notNull().default(1),
    sortOrder: int('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(false),
  },
  (table) => ({ bySort: index('coin_packages_sort_idx').on(table.sortOrder) }),
);

/** One verified store purchase; the unique order id makes a replayed callback harmless. */
export const coinPurchases = mysqlTable(
  'coin_purchases',
  {
    id: id(),
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    packageId: char('package_id', { length: 36 }).notNull().references(() => coinPackages.id),
    store: mysqlEnum('store', ['bazaar', 'myket', 'bale']).notNull(),
    storeOrderId: varchar('store_order_id', { length: 120 }).notNull(),
    coins: int('coins').notNull(),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({ orderUnique: uniqueIndex('coin_purchases_order_idx').on(table.store, table.storeOrderId) }),
);

/** What a player owns, one row per effect (e.g. how many hint tokens). */
export const userInventory = mysqlTable(
  'user_inventory',
  {
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    effect: mysqlEnum('effect', INVENTORY_EFFECTS).notNull(),
    qty: int('qty').notNull().default(0),
  },
  (table) => ({ pk: primaryKey({ columns: [table.userId, table.effect] }) }),
);

/** Every purchase, for the per-day limits and for support. The coins themselves are in `coin_ledger`. */
export const shopPurchases = mysqlTable(
  'shop_purchases',
  {
    id: id(),
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    itemId: char('item_id', { length: 36 }).notNull(),
    priceCoins: int('price_coins').notNull(),
    priceGems: int('price_gems').notNull().default(0),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({ byUserDay: index('shop_purchases_user_idx').on(table.userId, table.createdAt) }),
);

export const LANDING_POST_STATUS = ['draft', 'published'] as const;

/** Blog posts of the landing site `mrdozari.ir` (item 8, D173); written in Markdown in the admin panel. */
export const landingPosts = mysqlTable(
  'landing_posts',
  {
    id: id(),
    slug: varchar('slug', { length: 120 }).notNull(),
    titleFa: varchar('title_fa', { length: 160 }).notNull(),
    summaryFa: varchar('summary_fa', { length: 400 }).notNull().default(''),
    bodyMd: text('body_md').notNull(),
    metaTitle: varchar('meta_title', { length: 70 }),
    metaDescription: varchar('meta_description', { length: 200 }),
    coverUrl: varchar('cover_url', { length: 300 }),
    authorName: varchar('author_name', { length: 80 }).notNull().default(''),
    status: mysqlEnum('status', LANDING_POST_STATUS).notNull().default('draft'),
    publishedAt: datetime('published_at', { mode: 'date', fsp: 3 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (t) => ({ slugUnique: uniqueIndex('landing_posts_slug_idx').on(t.slug), byPublished: index('landing_posts_published_idx').on(t.status, t.publishedAt) }),
);

/** Old slugs of a renamed post: the landing site answers them with a 301 to the new one. */
export const landingSlugRedirects = mysqlTable('landing_slug_redirects', {
  oldSlug: varchar('old_slug', { length: 120 }).primaryKey(),
  postId: char('post_id', { length: 36 }).notNull().references(() => landingPosts.id, { onDelete: 'cascade' }),
});

/** The cast page: the characters and people of the game. */
export const landingCast = mysqlTable('landing_cast', {
  id: id(),
  nameFa: varchar('name_fa', { length: 80 }).notNull(),
  roleFa: varchar('role_fa', { length: 120 }).notNull().default(''),
  bioFa: text('bio_fa').notNull(),
  /** A character key of the app's art (`dozari`, `dozariF`, …) or an image address. */
  imageKey: varchar('image_key', { length: 200 }),
  sortOrder: int('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

/** Questions and answers of the landing page (also published as FAQ structured data). */
export const landingFaq = mysqlTable('landing_faq', {
  id: id(),
  questionFa: varchar('question_fa', { length: 200 }).notNull(),
  answerFa: text('answer_fa').notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

export const LANDING_COMMENT_TARGETS = ['post', 'cast'] as const;
export const LANDING_COMMENT_STATUS = ['pending', 'approved', 'hidden'] as const;

/** Visitor comments under a blog post or a cast member of the landing site; held `pending` until an admin approves them. */
export const landingComments = mysqlTable(
  'landing_comments',
  {
    id: id(),
    targetType: mysqlEnum('target_type', LANDING_COMMENT_TARGETS).notNull(),
    /** Post slug or cast id. */
    targetKey: varchar('target_key', { length: 120 }).notNull(),
    authorName: varchar('author_name', { length: 60 }).notNull(),
    body: varchar('body', { length: 1000 }).notNull(),
    status: mysqlEnum('status', LANDING_COMMENT_STATUS).notNull().default('pending'),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (t) => ({ byTarget: index('landing_comments_target_idx').on(t.targetType, t.targetKey, t.status, t.createdAt), byStatus: index('landing_comments_status_idx').on(t.status, t.createdAt) }),
);

/** Self-hosted short links for outgoing addresses (the `2oi.ir` domain, D172); the redirect counts every click. */
export const shortLinks = mysqlTable('short_links', {
  code: varchar('code', { length: 24 }).primaryKey(),
  targetUrl: varchar('target_url', { length: 1000 }).notNull(),
  note: varchar('note', { length: 120 }).notNull().default(''),
  clicks: int('clicks').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  lastClickAt: datetime('last_click_at', { mode: 'date', fsp: 3 }),
});

/**
 * Scheduled runs of the admin AI studio (docs/logic/ai-studio.md §Schedules): at each cron time the server asks the model for drafts of `kind` and saves them as drafts.
 * Flat columns, no JSON (D63): the options of every kind live side by side and a kind reads the ones it needs.
 */
export const aiSchedules = mysqlTable('ai_schedules', {
  id: id(),
  name: varchar('name', { length: 80 }).notNull(),
  kind: varchar('kind', { length: 20 }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  /** 5-field cron, read in Tehran time. */
  cron: varchar('cron', { length: 60 }).notNull(),
  provider: varchar('provider', { length: 20 }).notNull(),
  model: varchar('model', { length: 80 }).notNull().default(''),
  hint: varchar('hint', { length: 300 }).notNull().default(''),
  count: int('count').notNull().default(1),
  ageTrack: varchar('age_track', { length: 8 }).notNull().default('adult'),
  style: varchar('style', { length: 8 }).notNull().default('witty'),
  /** Puzzle tier the scheduled puzzles are for (puzzle_groups); null = mixed. */
  tierId: char('tier_id', { length: 36 }),
  category: varchar('category', { length: 40 }),
  fromYear: int('from_year'),
  toYear: int('to_year'),
  topic: varchar('topic', { length: 300 }).notNull().default(''),
  length: varchar('length', { length: 8 }).notNull().default('medium'),
  tone: varchar('tone', { length: 16 }).notNull().default('friendly'),
  nextRunAt: datetime('next_run_at', { mode: 'date', fsp: 3 }),
  lastRunAt: datetime('last_run_at', { mode: 'date', fsp: 3 }),
  /** 'ok' | 'empty' (nothing to do) | 'error' */
  lastStatus: varchar('last_status', { length: 8 }),
  lastMessage: varchar('last_message', { length: 300 }).notNull().default(''),
  lastSaved: int('last_saved').notNull().default(0),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
});

/** A player reported another player (profile), optionally over one chat message; the admin reviews them (docs/logic/ugc.md §Reports). */
export const userReports = mysqlTable(
  'user_reports',
  {
    id: id(),
    reporterId: char('reporter_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    targetId: char('target_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    category: mysqlEnum('category', ['abuse', 'spam', 'cheating', 'bad_name', 'other']).notNull(),
    details: varchar('details', { length: 500 }).notNull().default(''),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    resolvedAt: datetime('resolved_at', { mode: 'date', fsp: 3 }),
  },
  (table) => ({ byTarget: index('user_reports_target_idx').on(table.targetId, table.createdAt), byReporter: index('user_reports_reporter_idx').on(table.reporterId, table.createdAt) }),
);

/** An error the player's app reported (crash, failed screen or a manual report) with a screenshot, for the admin panel (docs/logic/client-errors.md). */
export const clientErrors = mysqlTable(
  'client_errors',
  {
    id: id(),
    userId: char('user_id', { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
    kind: mysqlEnum('kind', ['crash', 'screen', 'manual']).notNull(),
    screen: varchar('screen', { length: 64 }).notNull().default(''),
    message: varchar('message', { length: 500 }).notNull().default(''),
    detail: text('detail'),
    context: varchar('context', { length: 1500 }).notNull().default(''),
    note: varchar('note', { length: 500 }).notNull().default(''),
    /** `data:image/...;base64,` string; null when the screenshot could not be taken. */
    screenshot: mediumtext('screenshot'),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    resolvedAt: datetime('resolved_at', { mode: 'date', fsp: 3 }),
  },
  (table) => ({ byTime: index('client_errors_time_idx').on(table.createdAt), byUser: index('client_errors_user_idx').on(table.userId, table.createdAt) }),
);

/** A player's suggestion: a new item, a price for an item, or «this price is wrong» (docs/logic/ugc.md). */
export const ugcSubmissions = mysqlTable(
  'ugc_submissions',
  {
    id: id(),
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    kind: mysqlEnum('kind', ['item', 'price_point', 'price_report']).notNull(),
    status: mysqlEnum('status', ['pending', 'ready_for_review', 'approved', 'rejected']).notNull().default('pending'),
    productId: char('product_id', { length: 36 }),
    nameFa: varchar('name_fa', { length: 200 }).notNull().default(''),
    category: varchar('category', { length: 40 }),
    unitFa: varchar('unit_fa', { length: 100 }),
    year: smallint('year'),
    priceRials: bigint('price_rials', { mode: 'number' }),
    sourceType: mysqlEnum('source_type', ['website', 'user_memory', 'other']).notNull().default('user_memory'),
    sourceText: varchar('source_text', { length: 300 }).notNull().default(''),
    note: varchar('note', { length: 500 }).notNull().default(''),
    score: int('score').notNull().default(0),
    /** Set once when the reward was paid (the claim that makes approval pay exactly once). */
    rewardedAt: datetime('rewarded_at', { mode: 'date', fsp: 3 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    decidedAt: datetime('decided_at', { mode: 'date', fsp: 3 }),
  },
  (table) => ({ byStatus: index('ugc_submissions_status_idx').on(table.status, table.createdAt), byUser: index('ugc_submissions_user_idx').on(table.userId, table.createdAt) }),
);

/** One vote (+1 / −1) of a player on a submission; the key makes it one per player. */
export const ugcVotes = mysqlTable(
  'ugc_votes',
  {
    submissionId: char('submission_id', { length: 36 }).notNull().references(() => ugcSubmissions.id, { onDelete: 'cascade' }),
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    value: tinyint('value').notNull(),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({ pk: primaryKey({ columns: [table.submissionId, table.userId] }) }),
);

/** Invite ("gold") codes: one personal code per player, plus special codes an admin makes for campaigns (owner null). */
export const inviteCodes = mysqlTable(
  'invite_codes',
  {
    code: varchar('code', { length: 12 }).primaryKey(),
    ownerId: char('owner_id', { length: 36 }),
    /** Admin-only name of a special code, e.g. a campaign. */
    label: varchar('label', { length: 80 }),
    maxUses: int('max_uses').notNull(),
    uses: int('uses').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({ ownerUnique: uniqueIndex('invite_codes_owner_idx').on(table.ownerId) }),
);

/** One row per invited player (a player redeems exactly once, ever); the inviter reward is paid once. */
export const inviteRedemptions = mysqlTable(
  'invite_redemptions',
  {
    inviteeId: char('invitee_id', { length: 36 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 12 }).notNull(),
    /** Null for a campaign code (no inviter to reward). */
    inviterId: char('inviter_id', { length: 36 }),
    redeemedAt: datetime('redeemed_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    rewardPaidAt: datetime('reward_paid_at', { mode: 'date', fsp: 3 }),
  },
  (table) => ({ byInviter: index('invite_redemptions_inviter_idx').on(table.inviterId) }),
);

export const TRANSFER_KINDS = ['gift', 'loan'] as const;
export const TRANSFER_STATUSES = ['completed', 'offered', 'open', 'repaid', 'declined', 'cancelled'] as const;

/** Gifts (done at once) and loans (offered, then accepted, then repaid) between friends. The coins themselves move through `coin_ledger`. */
export const coinTransfers = mysqlTable(
  'coin_transfers',
  {
    id: id(),
    kind: mysqlEnum('kind', TRANSFER_KINDS).notNull(),
    status: mysqlEnum('status', TRANSFER_STATUSES).notNull(),
    fromUserId: char('from_user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    toUserId: char('to_user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    amount: int('amount').notNull(),
    /** Loans only: coins paid back so far. */
    repaid: int('repaid').notNull().default(0),
    dueAt: datetime('due_at', { mode: 'date', fsp: 3 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    closedAt: datetime('closed_at', { mode: 'date', fsp: 3 }),
  },
  (table) => ({
    byFrom: index('coin_transfers_from_idx').on(table.fromUserId, table.createdAt),
    byTo: index('coin_transfers_to_idx').on(table.toUserId, table.createdAt),
  }),
);

/** One live SMS code per player (hashed); a new code replaces the old one. */
export const phoneOtps = mysqlTable('phone_otps', {
  userId: char('user_id', { length: 36 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  phone: varchar('phone', { length: 16 }).notNull(),
  codeHash: char('code_hash', { length: 64 }).notNull(),
  attempts: int('attempts').notNull().default(0),
  sentAt: datetime('sent_at', { mode: 'date', fsp: 3 }).notNull(),
  expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
});

/** One live one-time code per player for deleting the account (hashed); a new code replaces the old one. */
export const accountDeleteCodes = mysqlTable('account_delete_codes', {
  userId: char('user_id', { length: 36 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: char('code_hash', { length: 64 }).notNull(),
  attempts: int('attempts').notNull().default(0),
  sentAt: datetime('sent_at', { mode: 'date', fsp: 3 }).notNull(),
  expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
});

/**
 * A number was proven (Bale contact or SMS) but another account already holds it: the player must choose which account keeps it
 * (docs/logic/bale-bot.md §Existing account). One row per asking player; it expires after 30 minutes.
 */
export const phoneConflicts = mysqlTable('phone_conflicts', {
  userId: char('user_id', { length: 36 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  phone: varchar('phone', { length: 16 }).notNull(),
  holderId: char('holder_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
});

export const BADGE_KINDS = ['badge', 'medal'] as const;
export const BADGE_PERKS = ['none', 'share_contact', 'moderator'] as const;
export const BADGE_RULE_METRICS = ['none', 'games', 'wins', 'level'] as const;

/** Badge and medal catalog, edited in the admin panel. A badge may carry a perk and an automatic unlock rule (metric >= min). */
export const badges = mysqlTable(
  'badges',
  {
    id: id(),
    slug: varchar('slug', { length: 40 }).notNull(),
    titleFa: varchar('title_fa', { length: 60 }).notNull(),
    descriptionFa: varchar('description_fa', { length: 200 }).notNull().default(''),
    kind: mysqlEnum('kind', BADGE_KINDS).notNull().default('badge'),
    iconKey: varchar('icon_key', { length: 30 }),
    perk: mysqlEnum('perk', BADGE_PERKS).notNull().default('none'),
    ruleMetric: mysqlEnum('rule_metric', BADGE_RULE_METRICS).notNull().default('none'),
    ruleMin: int('rule_min').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: int('sort_order').notNull().default(0),
  },
  (table) => ({ slugUnique: uniqueIndex('badges_slug_idx').on(table.slug) }),
);

export const userBadges = mysqlTable(
  'user_badges',
  {
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    badgeId: char('badge_id', { length: 36 }).notNull().references(() => badges.id, { onDelete: 'cascade' }),
    awardedAt: datetime('awarded_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    /** Null when the automatic rule awarded it; else the admin or agent that granted it. */
    awardedBy: varchar('awarded_by', { length: 40 }),
  },
  (table) => ({ pk: primaryKey({ columns: [table.userId, table.badgeId] }) }),
);

export const NOTICE_KINDS = ['warning', 'commendation'] as const;
export const ISSUER_TYPES = ['admin', 'agent'] as const;

/** Warnings and commendations a player received. */
export const userNotices = mysqlTable(
  'user_notices',
  {
    id: id(),
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    kind: mysqlEnum('kind', NOTICE_KINDS).notNull(),
    text: varchar('text', { length: 300 }).notNull(),
    issuerType: mysqlEnum('issuer_type', ISSUER_TYPES).notNull(),
    issuerId: char('issuer_id', { length: 36 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    readAt: datetime('read_at', { mode: 'date', fsp: 3 }),
  },
  (table) => ({ byUser: index('user_notices_user_idx').on(table.userId, table.createdAt) }),
);

/** One current chat mute per player (a newer one replaces it). */
export const chatMutes = mysqlTable('chat_mutes', {
  userId: char('user_id', { length: 36 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  until: datetime('until', { mode: 'date', fsp: 3 }).notNull(),
  reason: varchar('reason', { length: 200 }).notNull().default(''),
  issuerType: mysqlEnum('issuer_type', ISSUER_TYPES).notNull(),
  issuerId: char('issuer_id', { length: 36 }),
});

/** Every warn or mute an agent issued, for the daily limit and for review. */
export const modActions = mysqlTable(
  'mod_actions',
  {
    id: id(),
    agentId: char('agent_id', { length: 36 }).notNull(),
    targetId: char('target_id', { length: 36 }).notNull(),
    action: mysqlEnum('action', ['warn', 'mute']).notNull(),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({ byAgent: index('mod_actions_agent_idx').on(table.agentId, table.createdAt) }),
);

/** Groups of canned taunts («کل‌کل‌های آماده»), edited in the admin panel. */
export const tauntCategories = mysqlTable('taunt_categories', {
  id: id(),
  nameFa: varchar('name_fa', { length: 40 }).notNull(),
  /** Set = a dialect/local category shown only to players of that city (owner item 9); null = everyone. */
  cityId: char('city_id', { length: 36 }).references(() => cities.id, { onDelete: 'set null' }),
  sortOrder: int('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  /** The track whose players see the category: each track has its own taunt library (docs/logic/age-tracks.md). */
  ageTrack: mysqlEnum('age_track', AGE_TRACKS).notNull().default('adult'),
});

export const cannedTaunts = mysqlTable(
  'canned_taunts',
  {
    id: id(),
    categoryId: char('category_id', { length: 36 }).notNull().references(() => tauntCategories.id, { onDelete: 'cascade' }),
    text: varchar('text', { length: 120 }).notNull(),
    sortOrder: int('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => ({ byCategory: index('canned_taunts_category_idx').on(table.categoryId, table.sortOrder) }),
);

/** One row per chat message. `roomKey` is the city id for the city room, the match id for a duel, `all` for the global room, the table code for a private table, the two user ids sorted and joined by `:` for a friends' private chat. Kept 30 days for moderation. */
export const chatMessages = mysqlTable(
  'chat_messages',
  {
    id: id(),
    room: mysqlEnum('room', ['city', 'match', 'global', 'dm', 'table']).notNull(),
    roomKey: varchar('room_key', { length: 64 }).notNull(),
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    kind: mysqlEnum('kind', ['text', 'taunt', 'table']).notNull(),
    text: varchar('text', { length: 500 }).notNull(),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    /** Set when an admin removes the message; it disappears from history. */
    deletedAt: datetime('deleted_at', { mode: 'date', fsp: 3 }),
  },
  (table) => ({ byRoom: index('chat_messages_room_idx').on(table.room, table.roomKey, table.createdAt) }),
);

export const chatReports = mysqlTable(
  'chat_reports',
  {
    id: id(),
    messageId: char('message_id', { length: 36 }).notNull().references(() => chatMessages.id, { onDelete: 'cascade' }),
    reporterId: char('reporter_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    reason: varchar('reason', { length: 200 }).notNull().default(''),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    resolvedAt: datetime('resolved_at', { mode: 'date', fsp: 3 }),
  },
  (table) => ({ oncePerReporter: uniqueIndex('chat_reports_once_idx').on(table.messageId, table.reporterId) }),
);

/** A sponsor defined in the admin panel: name, banner and story shown on the tournaments it sponsors (docs/logic/sponsors.md). */
export const sponsors = mysqlTable('sponsors', {
  id: id(),
  nameFa: varchar('name_fa', { length: 60 }).notNull(),
  taglineFa: varchar('tagline_fa', { length: 120 }).notNull().default(''),
  descriptionFa: text('description_fa').notNull(),
  /** https URL of the banner / logo (self-hosted image; rule 8: nothing from Google). */
  bannerUrl: varchar('banner_url', { length: 300 }),
  logoUrl: varchar('logo_url', { length: 300 }),
  linkUrl: varchar('link_url', { length: 300 }),
  /** `#RRGGBB` accent of the sponsor card. */
  accent: varchar('accent', { length: 7 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
});

export const TOURNAMENT_STATUS_VALUES = ['draft', 'open', 'running', 'finished', 'cancelled'] as const;

/** A single-elimination tournament built in the admin panel (docs/logic/tournaments.md). */
export const tournaments = mysqlTable(
  'tournaments',
  {
    id: id(),
    titleFa: varchar('title_fa', { length: 80 }).notNull(),
    descriptionFa: text('description_fa').notNull(),
    iconKey: varchar('icon_key', { length: 30 }),
    status: mysqlEnum('status', TOURNAMENT_STATUS_VALUES).notNull().default('draft'),
    /** Bracket size: 4, 8, 16 or 32. */
    size: int('size').notNull(),
    /** The tournament still starts with at least this many players (the rest of the bracket gets byes). */
    minPlayers: int('min_players').notNull().default(4),
    entryCoins: int('entry_coins').notNull().default(0),
    /** Gems charged on top of the coins (0 = none). */
    entryGems: int('entry_gems').notNull().default(0),
    minLevel: int('min_level').notNull().default(1),
    /** When the bracket is not full at the start, empty seats are filled with bot players. */
    botFill: boolean('bot_fill').notNull().default(false),
    /** Off by default: a player may be in one open or running tournament at a time. On = they may also join this one while in another. */
    allowConcurrent: boolean('allow_concurrent').notNull().default(false),
    /** Who sponsors this tournament (shown with a banner on its page); null = nobody. */
    sponsorId: char('sponsor_id', { length: 36 }),
    /** Registration closes and the first round starts at this time. */
    startsAt: datetime('starts_at', { mode: 'date', fsp: 3 }).notNull(),
    startedAt: datetime('started_at', { mode: 'date', fsp: 3 }),
    finishedAt: datetime('finished_at', { mode: 'date', fsp: 3 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({ byStatus: index('tournaments_status_idx').on(table.status, table.startsAt) }),
);

/** Prize coins by final place (1, 2, 3; place 3 is paid to both semi-final losers). */
export const tournamentPrizes = mysqlTable(
  'tournament_prizes',
  {
    tournamentId: char('tournament_id', { length: 36 }).notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
    place: int('place').notNull(),
    coins: int('coins').notNull(),
    /** Gems given besides the coins. */
    gems: int('gems').notNull().default(0),
    /** Lucky-wheel spins given besides the coins. */
    spins: int('spins').notNull().default(0),
  },
  (table) => ({ pk: primaryKey({ columns: [table.tournamentId, table.place] }) }),
);

export const tournamentEntries = mysqlTable(
  'tournament_entries',
  {
    tournamentId: char('tournament_id', { length: 36 }).notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: datetime('joined_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    /** Fee paid, kept for the refund. */
    paid: int('paid').notNull().default(0),
    paidGems: int('paid_gems').notNull().default(0),
  },
  (table) => ({ pk: primaryKey({ columns: [table.tournamentId, table.userId] }) }),
);

export const TOURNAMENT_MATCH_STATUS = ['waiting', 'ready', 'playing', 'done', 'bye'] as const;

export const tournamentMatches = mysqlTable(
  'tournament_matches',
  {
    id: id(),
    tournamentId: char('tournament_id', { length: 36 }).notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
    round: int('round').notNull(),
    slot: int('slot').notNull(),
    playerA: char('player_a', { length: 36 }),
    playerB: char('player_b', { length: 36 }),
    winnerId: char('winner_id', { length: 36 }),
    status: mysqlEnum('status', TOURNAMENT_MATCH_STATUS).notNull().default('waiting'),
  },
  (table) => ({ slotUnique: uniqueIndex('tournament_matches_slot_idx').on(table.tournamentId, table.round, table.slot) }),
);

/** Behaviour of a bot account (the identity itself is an ordinary `users` row with `is_bot`). */
export const botPlayers = mysqlTable('bot_players', {
  userId: char('user_id', { length: 36 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  /** 0–100: how often it finds a real group. */
  skill: int('skill').notNull().default(50),
  thinkMinMs: int('think_min_ms').notNull().default(3000),
  thinkMaxMs: int('think_max_ms').notNull().default(12000),
  /** Chance it answers a canned taunt of the human opponent. */
  tauntPercent: int('taunt_percent').notNull().default(40),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
});

/** A reason a day's puzzle is chosen: an occasion, season, trend or category (docs/logic/daily-puzzle.md). */
export const puzzleThemes = mysqlTable('puzzle_themes', {
  id: id(),
  titleFa: varchar('title_fa', { length: 80 }).notNull(),
  kind: mysqlEnum('kind', ['occasion', 'season', 'trend', 'category', 'custom']).notNull().default('custom'),
  weight: int('weight').notNull().default(1),
  /** Recurring yearly Solar Hijri window; all four set or all null. */
  startMonth: tinyint('start_month'),
  startDay: tinyint('start_day'),
  endMonth: tinyint('end_month'),
  endDay: tinyint('end_day'),
  /** Absolute Gregorian window in Tehran time, `YYYY-MM-DD`. */
  fromDate: char('from_date', { length: 10 }),
  toDate: char('to_date', { length: 10 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
});

export const puzzleThemeLinks = mysqlTable(
  'puzzle_theme_links',
  {
    themeId: char('theme_id', { length: 36 }).notNull().references(() => puzzleThemes.id, { onDelete: 'cascade' }),
    puzzleId: char('puzzle_id', { length: 36 }).notNull().references(() => puzzles.id, { onDelete: 'cascade' }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.themeId, t.puzzleId] }) }),
);

/** The puzzle of a Tehran day (`YYYY-MM-DD`); one row per day, written when first needed or pinned by an admin. */
export const dailyPuzzles = mysqlTable('daily_puzzles', {
  dateKey: char('date_key', { length: 10 }).primaryKey(),
  puzzleId: char('puzzle_id', { length: 36 }).notNull().references(() => puzzles.id),
  themeId: char('theme_id', { length: 36 }).references(() => puzzleThemes.id, { onDelete: 'set null' }),
  pinnedBy: mysqlEnum('pinned_by', ['auto', 'admin']).notNull().default('auto'),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
});

/** How many games of one mode a player started on one Tehran day (admin-set daily caps read this). */
export const dailyPlayCounts = mysqlTable(
  'daily_play_counts',
  {
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    dateKey: char('date_key', { length: 10 }).notNull(),
    mode: mysqlEnum('mode', ['solo', 'duel', 'duel_free']).notNull(),
    count: int('count').notNull().default(0),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.dateKey, t.mode] }) }),
);

/**
 * A lucky-wheel spin (docs/logic/economy.md §Lucky wheel). `source`: `win` (a won duel, `match_id`), `shop`, `level`, `tournament`, `daily`, `admin`;
 * non-win spins carry a `ref` that makes the grant idempotent. `coins` stays null until it is spun.
 */
export const WHEEL_PRIZE_KIND_VALUES = ['coins', 'gems', 'hint_token', 'wheel_spin', 'cosmetic'] as const;

/** The wheel's live prize table (docs/logic/economy.md §Lucky wheel, D165): one row per slice, edited in the admin panel. Seeded from the shared default when empty. */
export const wheelPrizes = mysqlTable(
  'wheel_prizes',
  {
    id: id(),
    kind: mysqlEnum('kind', WHEEL_PRIZE_KIND_VALUES).notNull(),
    amount: int('amount').notNull(),
    /** The shop item (effect `cosmetic`) a `cosmetic` slice gives. */
    itemId: char('item_id', { length: 36 }),
    /** Relative odds; 0 never wins. */
    weight: int('weight').notNull(),
    sortOrder: int('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => ({ bySort: index('wheel_prizes_sort_idx').on(t.sortOrder) }),
);

export const wheelSpins = mysqlTable(
  'wheel_spins',
  {
    id: id(),
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    matchId: char('match_id', { length: 36 }),
    source: varchar('source', { length: 16 }).notNull().default('win'),
    ref: varchar('ref', { length: 80 }),
    coins: int('coins'),
    /** What the spin won (set when spun); `coins` above keeps the coin amount for older rows. */
    prizeKind: varchar('prize_kind', { length: 16 }),
    prizeAmount: int('prize_amount'),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    spunAt: datetime('spun_at', { mode: 'date', fsp: 3 }),
  },
  (t) => ({ onePerMatch: uniqueIndex('wheel_spins_user_match').on(t.userId, t.matchId), onePerRef: uniqueIndex('wheel_spins_user_ref').on(t.userId, t.source, t.ref), pending: index('wheel_spins_pending').on(t.userId, t.spunAt) }),
);

/** The admin's level table (docs/logic/progression.md §Level table): XP at which each level starts and the coin reward for reaching it. Empty = the formulas of the settings. */
export const levelRoad = mysqlTable('level_road', {
  level: int('level').primaryKey(),
  startXp: int('start_xp').notNull(),
  rewardCoins: int('reward_coins').notNull().default(0),
  /** Lucky-wheel spins given besides the coins when the level is reached. */
  rewardSpins: int('reward_spins').notNull().default(0),
});

/** Level-road coin rewards a player has taken (docs/logic/progression.md §Level rewards). */
export const levelRewardClaims = mysqlTable(
  'level_reward_claims',
  {
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    level: int('level').notNull(),
    claimedAt: datetime('claimed_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.level] }) }),
);

/** Profile-completion rewards a player has taken, one row per step (docs/logic/profile-and-identity.md, D161). */
export const profileTaskClaims = mysqlTable(
  'profile_task_claims',
  {
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    taskKey: varchar('task_key', { length: 20 }).notNull(),
    claimedAt: datetime('claimed_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.taskKey] }) }),
);

/** The birthday gift taken in a Solar Hijri year: one row per player and year is the once-a-year lock (D160). */
export const birthdayClaims = mysqlTable(
  'birthday_claims',
  {
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    year: smallint('year').notNull(),
    claimedAt: datetime('claimed_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.year] }) }),
);

/** Which friend messages were already sent for a player's birthday in a year (`week` = the week started, `day` = the day itself). */
export const birthdayNotices = mysqlTable(
  'birthday_notices',
  {
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    year: smallint('year').notNull(),
    stage: mysqlEnum('stage', ['week', 'day']).notNull(),
    sentAt: datetime('sent_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.year, t.stage] }) }),
);

/** One attempt per player per day. */
export const dailyPuzzlePlays = mysqlTable(
  'daily_puzzle_plays',
  {
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    dateKey: char('date_key', { length: 10 }).notNull(),
    result: mysqlEnum('result', ['playing', 'won', 'lost']).notNull().default('playing'),
    startedAt: datetime('started_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    finishedAt: datetime('finished_at', { mode: 'date', fsp: 3 }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.dateKey] }) }),
);

/** An S3-compatible place database backups are sent to, with its schedule and retention rule (docs/logic/backups.md). The secret key is stored encrypted. */
export const backupTargets = mysqlTable('backup_targets', {
  id: id(),
  name: varchar('name', { length: 80 }).notNull(),
  endpoint: varchar('endpoint', { length: 300 }).notNull(),
  region: varchar('region', { length: 60 }).notNull().default(''),
  bucket: varchar('bucket', { length: 120 }).notNull(),
  prefix: varchar('prefix', { length: 200 }).notNull().default(''),
  accessKey: varchar('access_key', { length: 200 }).notNull(),
  secretKeyEnc: varchar('secret_key_enc', { length: 600 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  scheduleKind: mysqlEnum('schedule_kind', ['hourly', 'daily', 'weekly']).notNull().default('daily'),
  scheduleEveryHours: smallint('schedule_every_hours', { unsigned: true }).notNull().default(24),
  scheduleTime: varchar('schedule_time', { length: 5 }).notNull().default('03:00'),
  scheduleWeekday: tinyint('schedule_weekday', { unsigned: true }).notNull().default(0),
  keepDays: smallint('keep_days', { unsigned: true }),
  keepCount: smallint('keep_count', { unsigned: true }),
  /** When the scheduler last started this target; the next slot is computed from it (or from `createdAt`). */
  lastScheduledAt: datetime('last_scheduled_at', { mode: 'date', fsp: 3 }),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
});

/** One backup attempt of a target. `objectKey` is the file in the bucket; `deletedAt` is set once retention or an admin removed it. */
export const backupRuns = mysqlTable(
  'backup_runs',
  {
    id: id(),
    targetId: char('target_id', { length: 36 }).notNull().references(() => backupTargets.id, { onDelete: 'cascade' }),
    trigger: mysqlEnum('trigger', ['schedule', 'manual']).notNull(),
    status: mysqlEnum('status', ['running', 'ok', 'failed']).notNull().default('running'),
    objectKey: varchar('object_key', { length: 400 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number', unsigned: true }),
    error: varchar('error', { length: 500 }),
    startedAt: datetime('started_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
    finishedAt: datetime('finished_at', { mode: 'date', fsp: 3 }),
    deletedAt: datetime('deleted_at', { mode: 'date', fsp: 3 }),
    deletedReason: mysqlEnum('deleted_reason', ['retention', 'manual']),
  },
  (t) => [index('backup_runs_target_started_idx').on(t.targetId, t.startedAt)],
);
