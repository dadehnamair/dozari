CREATE TABLE `puzzle_tiers` (
	`id` char(36) NOT NULL,
	`name_fa` varchar(40) NOT NULL,
	`sort_order` int NOT NULL,
	`min_level` int NOT NULL DEFAULT 1,
	`max_level` int,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `puzzle_tiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `puzzles` ADD `tier_id` char(36);