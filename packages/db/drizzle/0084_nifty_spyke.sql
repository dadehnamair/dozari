CREATE TABLE `puzzle_tag_defs` (
	`id` char(36) NOT NULL,
	`slug` varchar(50) NOT NULL,
	`name_fa` varchar(60) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `puzzle_tag_defs_id` PRIMARY KEY(`id`),
	CONSTRAINT `puzzle_tag_defs_slug_unique` UNIQUE(`slug`)
);
