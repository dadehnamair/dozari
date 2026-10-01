CREATE TABLE `group_title_templates` (
	`id` char(36) NOT NULL,
	`rule_kind` enum('price_band_at_year','same_price_at_year','first_crossed','multiplier_between','cheaper_than_ref','era_icon','category_price_rank','curated') NOT NULL,
	`title_fa` varchar(100) NOT NULL,
	`tone` enum('funny','nostalgic','neutral') NOT NULL DEFAULT 'funny',
	`min_level` tinyint NOT NULL DEFAULT 0,
	`max_level` tinyint NOT NULL DEFAULT 3,
	`is_active` boolean NOT NULL DEFAULT true,
	`times_chosen` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `group_title_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `puzzle_group_items` (
	`group_id` char(36) NOT NULL,
	`puzzle_id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`display_year` smallint,
	CONSTRAINT `puzzle_group_items_group_id_product_id_pk` PRIMARY KEY(`group_id`,`product_id`),
	CONSTRAINT `puzzle_group_items_puzzle_product_idx` UNIQUE(`puzzle_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `puzzle_groups` (
	`id` char(36) NOT NULL,
	`puzzle_id` char(36) NOT NULL,
	`level` tinyint NOT NULL,
	`title_fa` varchar(100),
	`explanation_fa` varchar(300),
	`rule_kind` enum('price_band_at_year','same_price_at_year','first_crossed','multiplier_between','cheaper_than_ref','era_icon','category_price_rank','curated') NOT NULL,
	`rule_year` smallint,
	`rule_year_b` smallint,
	`rule_min_rials` bigint,
	`rule_max_rials` bigint,
	`rule_target_rials` bigint,
	`rule_threshold_rials` bigint,
	`rule_tolerance_pct` smallint,
	`rule_from_year` smallint,
	`rule_to_year` smallint,
	`rule_min_x` int,
	`rule_max_x` int,
	`rule_rank` smallint,
	`rule_ref_product_id` char(36),
	`rule_era_tag` varchar(50),
	`rule_category` enum('car','food','snack','drink','digital','electronics','housing','transport','education','entertainment','clothing','hygiene','service','other'),
	`rule_note` varchar(300),
	CONSTRAINT `puzzle_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `puzzle_groups_puzzle_level_idx` UNIQUE(`puzzle_id`,`level`)
);
--> statement-breakpoint
CREATE TABLE `puzzles` (
	`id` char(36) NOT NULL,
	`status` enum('draft','approved','retired') NOT NULL DEFAULT 'draft',
	`source` enum('generated','curated','ugc') NOT NULL,
	`author_id` char(36),
	`seed` bigint,
	`difficulty_score` double,
	`times_played` int NOT NULL DEFAULT 0,
	`avg_solve_rate` double,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `puzzles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `puzzle_group_items` ADD CONSTRAINT `puzzle_group_items_group_id_puzzle_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `puzzle_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `puzzle_group_items` ADD CONSTRAINT `puzzle_group_items_puzzle_id_puzzles_id_fk` FOREIGN KEY (`puzzle_id`) REFERENCES `puzzles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `puzzle_group_items` ADD CONSTRAINT `puzzle_group_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `puzzle_groups` ADD CONSTRAINT `puzzle_groups_puzzle_id_puzzles_id_fk` FOREIGN KEY (`puzzle_id`) REFERENCES `puzzles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `puzzle_groups` ADD CONSTRAINT `puzzle_groups_rule_ref_product_id_products_id_fk` FOREIGN KEY (`rule_ref_product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `group_title_templates_kind_idx` ON `group_title_templates` (`rule_kind`,`is_active`);