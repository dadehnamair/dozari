ALTER TABLE `price_points` DROP INDEX `price_points_product_year_month_approved_idx`;--> statement-breakpoint
ALTER TABLE `price_points` ADD `month_key` smallint GENERATED ALWAYS AS (COALESCE(month, 0)) STORED;--> statement-breakpoint
ALTER TABLE `price_points` ADD CONSTRAINT `price_points_product_year_month_approved_idx` UNIQUE(`product_id`,`year`,`month_key`,`approved_flag`);