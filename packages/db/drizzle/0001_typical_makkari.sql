CREATE TABLE `puzzle_group_items` (
	`group_id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`display_year` smallint,
	CONSTRAINT `puzzle_group_items_group_id_product_id_pk` PRIMARY KEY(`group_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `puzzle_groups` (
	`id` char(36) NOT NULL,
	`puzzle_id` char(36) NOT NULL,
	`level` smallint NOT NULL,
	`title_fa` varchar(300) NOT NULL,
	`explanation_fa` varchar(500) NOT NULL,
	`rule_kind` enum('era_icon','price_band_at_year','same_price_at_year','first_crossed','multiplier_between','curated') NOT NULL,
	`rule_era_tag` varchar(50),
	`rule_year` smallint,
	`rule_year_to` smallint,
	`rule_min_rials` bigint,
	`rule_max_rials` bigint,
	`rule_target_rials` bigint,
	`rule_threshold_rials` bigint,
	`rule_tolerance_pct` smallint,
	`rule_min_multiplier` bigint,
	CONSTRAINT `puzzle_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `puzzle_groups_puzzle_level_idx` UNIQUE(`puzzle_id`,`level`)
);
--> statement-breakpoint
CREATE TABLE `puzzles` (
	`id` char(36) NOT NULL,
	`slug` varchar(100),
	`status` enum('draft','approved','retired') NOT NULL DEFAULT 'draft',
	`source` enum('generated','curated','ugc') NOT NULL,
	`author_id` char(36),
	`seed` bigint,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `puzzles_id` PRIMARY KEY(`id`),
	CONSTRAINT `puzzles_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `products` ADD `icon` varchar(16);--> statement-breakpoint
ALTER TABLE `puzzle_group_items` ADD CONSTRAINT `puzzle_group_items_group_id_puzzle_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `puzzle_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `puzzle_group_items` ADD CONSTRAINT `puzzle_group_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `puzzle_groups` ADD CONSTRAINT `puzzle_groups_puzzle_id_puzzles_id_fk` FOREIGN KEY (`puzzle_id`) REFERENCES `puzzles`(`id`) ON DELETE cascade ON UPDATE no action;