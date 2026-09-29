import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Phase 0 scope only (docs/PLAN.md): `products` and `price_points`, per
 * docs/logic/data-model.md §Catalog. The rest of the data model (puzzles, users, matches,
 * economy, UGC) lands in later phases as those features are built.
 */

export const productCategoryEnum = pgEnum('product_category', [
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
]);

export const productStatusEnum = pgEnum('product_status', [
  'in_production',
  'discontinued',
  'changed',
]);

export const priceSourceTypeEnum = pgEnum('price_source_type', [
  'archive_newspaper',
  'official_list',
  'receipt_photo',
  'website',
  'user_memory',
  'other',
]);

export const priceStatusEnum = pgEnum('price_status', ['approved', 'pending', 'rejected']);

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  nameFa: text('name_fa').notNull(),
  brand: text('brand'),
  category: productCategoryEnum('category').notNull(),
  unitFa: text('unit_fa'),
  audience: text('audience').array().notNull().default(sql`'{}'::text[]`),
  eraTags: text('era_tags').array().notNull().default(sql`'{}'::text[]`),
  storyFa: text('story_fa'),
  status: productStatusEnum('status').notNull().default('in_production'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pricePoints = pgTable(
  'price_points',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    year: smallint('year').notNull(),
    month: smallint('month'),
    // Rule 2: nominal, integer rials, never inflation-adjusted, never a float.
    priceRials: bigint('price_rials', { mode: 'bigint' }).notNull(),
    sourceType: priceSourceTypeEnum('source_type').notNull(),
    sourceUrl: text('source_url'),
    sourceNote: text('source_note'),
    confidence: smallint('confidence').notNull(),
    status: priceStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Unique (product, year, month) only among approved rows — matches data-model.md's
    // "Unique (product_id, year, month) where status = approved".
    uniqueIndex('price_points_product_year_month_approved_idx')
      .on(table.productId, table.year, table.month)
      .where(sql`${table.status} = 'approved'`),
    index('price_points_product_id_idx').on(table.productId),
  ],
);
