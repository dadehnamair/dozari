CREATE TABLE IF NOT EXISTS "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"year_from" smallint,
	"year_to" smallint,
	"is_primary" boolean DEFAULT false NOT NULL,
	"credit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_images_product_url_idx" ON "product_images" USING btree ("product_id","url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_images_product_id_idx" ON "product_images" USING btree ("product_id");