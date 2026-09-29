CREATE TABLE `price_points` (
	`id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`year` smallint NOT NULL,
	`month` smallint,
	`price_rials` bigint NOT NULL,
	`source_type` enum('archive_newspaper','official_list','receipt_photo','website','user_memory','other') NOT NULL,
	`source_url` varchar(1000),
	`source_note` text,
	`confidence` smallint NOT NULL,
	`status` enum('approved','pending','rejected') NOT NULL DEFAULT 'pending',
	`approved_flag` tinyint GENERATED ALWAYS AS (IF(status = 'approved', 1, NULL)) STORED,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `price_points_id` PRIMARY KEY(`id`),
	CONSTRAINT `price_points_product_year_month_approved_idx` UNIQUE(`product_id`,`year`,`month`,`approved_flag`)
);
--> statement-breakpoint
CREATE TABLE `product_audiences` (
	`product_id` char(36) NOT NULL,
	`audience` enum('kids','teens','adults','elderly','family') NOT NULL,
	CONSTRAINT `product_audiences_product_id_audience_pk` PRIMARY KEY(`product_id`,`audience`)
);
--> statement-breakpoint
CREATE TABLE `product_era_tags` (
	`product_id` char(36) NOT NULL,
	`tag` varchar(50) NOT NULL,
	CONSTRAINT `product_era_tags_product_id_tag_pk` PRIMARY KEY(`product_id`,`tag`)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`url` varchar(500) NOT NULL,
	`year_from` smallint,
	`year_to` smallint,
	`is_primary` boolean NOT NULL DEFAULT false,
	`credit` varchar(300),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_images_product_url_idx` UNIQUE(`product_id`,`url`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` char(36) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name_fa` varchar(200) NOT NULL,
	`brand` varchar(200),
	`category` enum('car','food','snack','drink','digital','electronics','housing','transport','education','entertainment','clothing','hygiene','service','other') NOT NULL,
	`unit_fa` varchar(100),
	`story_fa` text,
	`status` enum('in_production','discontinued','changed') NOT NULL DEFAULT 'in_production',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `price_points` ADD CONSTRAINT `price_points_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_audiences` ADD CONSTRAINT `product_audiences_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_era_tags` ADD CONSTRAINT `product_era_tags_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `price_points_product_id_idx` ON `price_points` (`product_id`);