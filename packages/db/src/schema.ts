import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  datetime,
  index,
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
  // Emoji stand-in for a product photo on puzzle tiles (content, not UI chrome).
  icon: varchar('icon', { length: 16 }),
  brand: varchar('brand', { length: 200 }),
  category: mysqlEnum('category', PRODUCT_CATEGORY_VALUES).notNull(),
  unitFa: varchar('unit_fa', { length: 100 }),
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
    // otherwise, so UNIQUE(product, year, month, approved_flag) only constrains approved rows
    // (NULLs never collide) — matches data-model.md's "unique where status = approved".
    approvedFlag: tinyint('approved_flag').generatedAlwaysAs(
      sql`IF(status = 'approved', 1, NULL)`,
      { mode: 'stored' },
    ),
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
      table.month,
      table.approvedFlag,
    ),
    byProduct: index('price_points_product_id_idx').on(table.productId),
  }),
);

export const PUZZLE_RULE_KIND_VALUES = [
  'era_icon',
  'price_band_at_year',
  'same_price_at_year',
  'first_crossed',
  'multiplier_between',
  'curated',
] as const;

export const puzzles = mysqlTable('puzzles', {
  id: id(),
  // Stable handle for seeded puzzles (re-runnable by slug); null for generated/UGC ones.
  slug: varchar('slug', { length: 100 }).unique(),
  status: mysqlEnum('status', ['draft', 'approved', 'retired']).notNull().default('draft'),
  source: mysqlEnum('source', ['generated', 'curated', 'ugc']).notNull(),
  authorId: char('author_id', { length: 36 }),
  seed: bigint('seed', { mode: 'bigint' }),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(now()),
});

/**
 * One row per group (exactly 4 per puzzle). The rule is flattened into nullable columns instead
 * of a JSON column (D63): which ones are set depends on `rule_kind`. Money is integer rials.
 */
export const puzzleGroups = mysqlTable(
  'puzzle_groups',
  {
    id: id(),
    puzzleId: fk('puzzle_id').references(() => puzzles.id, { onDelete: 'cascade' }),
    level: smallint('level').notNull(), // 0 yellow … 3 purple
    titleFa: varchar('title_fa', { length: 300 }).notNull(),
    explanationFa: varchar('explanation_fa', { length: 500 }).notNull(),
    ruleKind: mysqlEnum('rule_kind', PUZZLE_RULE_KIND_VALUES).notNull(),
    ruleEraTag: varchar('rule_era_tag', { length: 50 }),
    ruleYear: smallint('rule_year'),
    ruleYearTo: smallint('rule_year_to'), // first_crossed.to / multiplier_between.year_b
    ruleMinRials: bigint('rule_min_rials', { mode: 'bigint' }),
    ruleMaxRials: bigint('rule_max_rials', { mode: 'bigint' }),
    ruleTargetRials: bigint('rule_target_rials', { mode: 'bigint' }),
    ruleThresholdRials: bigint('rule_threshold_rials', { mode: 'bigint' }),
    ruleTolerancePct: smallint('rule_tolerance_pct'),
    // multiplier_between: year_a lives in rule_year; minimum multiplier as an integer ×.
    ruleMinMultiplier: bigint('rule_min_multiplier', { mode: 'bigint' }),
  },
  (table) => ({
    puzzleLevel: uniqueIndex('puzzle_groups_puzzle_level_idx').on(table.puzzleId, table.level),
  }),
);

export const puzzleGroupItems = mysqlTable(
  'puzzle_group_items',
  {
    groupId: fk('group_id').references(() => puzzleGroups.id, { onDelete: 'cascade' }),
    productId: fk('product_id').references(() => products.id),
    displayYear: smallint('display_year'),
  },
  (table) => ({ pk: primaryKey({ columns: [table.groupId, table.productId] }) }),
);
