CREATE TYPE "public"."price_source_type" AS ENUM('archive_newspaper', 'official_list', 'receipt_photo', 'website', 'user_memory', 'other');--> statement-breakpoint
CREATE TYPE "public"."price_status" AS ENUM('approved', 'pending', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."product_category" AS ENUM('car', 'food', 'snack', 'drink', 'digital', 'electronics', 'housing', 'transport', 'education', 'entertainment', 'clothing', 'hygiene', 'service', 'other');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('in_production', 'discontinued', 'changed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"year" smallint NOT NULL,
	"month" smallint,
	"price_rials" bigint NOT NULL,
	"source_type" "price_source_type" NOT NULL,
	"source_url" text,
	"source_note" text,
	"confidence" smallint NOT NULL,
	"status" "price_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_fa" text NOT NULL,
	"brand" text,
	"category" "product_category" NOT NULL,
	"unit_fa" text,
	"audience" text[] DEFAULT '{}'::text[] NOT NULL,
	"era_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"story_fa" text,
	"status" "product_status" DEFAULT 'in_production' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "price_points" ADD CONSTRAINT "price_points_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "price_points_product_year_month_approved_idx" ON "price_points" USING btree ("product_id","year","month") WHERE "price_points"."status" = 'approved';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_points_product_id_idx" ON "price_points" USING btree ("product_id");