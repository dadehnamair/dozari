import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  datetime,
  double,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
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
  createdBy: char('created_by', { length: 36 }),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
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
export const puzzles = mysqlTable('puzzles', {
  id: id(),
  status: mysqlEnum('status', ['draft', 'approved', 'retired']).notNull().default('draft'),
  source: mysqlEnum('source', ['generated', 'curated', 'ugc']).notNull(),
  authorId: char('author_id', { length: 36 }),
  seed: bigint('seed', { mode: 'bigint' }),
  difficultyScore: double('difficulty_score'),
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
    /** Set when the player redeems an invite code: it activates free chat, renaming and gifts (chat-and-access.md). */
    chatUnlockedAt: datetime('chat_unlocked_at', { mode: 'date', fsp: 3 }),
    /** Home city (a row of `cities`), optional; shown on the profile and used for the city room. */
    cityId: char('city_id', { length: 36 }),
    /** Optional contact e-mail; private and not verified yet. */
    email: varchar('email', { length: 120 }),
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
  }),
);

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

export const MESSAGE_AUDIENCES = ['all', 'bale_linked', 'user'] as const;
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
    sortOrder: int('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => ({ slugUnique: uniqueIndex('cities_slug_idx').on(table.slug) }),
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

export const SHOP_EFFECTS = ['hint_token'] as const;

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
    priceCoins: int('price_coins').notNull(),
    minLevel: int('min_level').notNull().default(1),
    /** 0 = no daily limit. */
    perDayLimit: int('per_day_limit').notNull().default(0),
    iconKey: varchar('icon_key', { length: 30 }),
    sortOrder: int('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => ({ bySort: index('shop_items_sort_idx').on(table.sortOrder) }),
);

/** What a player owns, one row per effect (e.g. how many hint tokens). */
export const userInventory = mysqlTable(
  'user_inventory',
  {
    userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    effect: mysqlEnum('effect', SHOP_EFFECTS).notNull(),
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
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
  },
  (table) => ({ byUserDay: index('shop_purchases_user_idx').on(table.userId, table.createdAt) }),
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
