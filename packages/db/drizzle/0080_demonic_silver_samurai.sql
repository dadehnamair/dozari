CREATE TABLE `puzzle_tags` (
	`puzzle_id` char(36) NOT NULL,
	`tag` varchar(50) NOT NULL,
	CONSTRAINT `puzzle_tags_puzzle_id_tag_pk` PRIMARY KEY(`puzzle_id`,`tag`)
);
--> statement-breakpoint
CREATE TABLE `puzzle_topics` (
	`id` char(36) NOT NULL,
	`slug` varchar(50) NOT NULL,
	`name_fa` varchar(60) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `puzzle_topics_id` PRIMARY KEY(`id`),
	CONSTRAINT `puzzle_topics_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `puzzles` ADD `topic_id` char(36);--> statement-breakpoint
ALTER TABLE `puzzle_tags` ADD CONSTRAINT `puzzle_tags_puzzle_id_puzzles_id_fk` FOREIGN KEY (`puzzle_id`) REFERENCES `puzzles`(`id`) ON DELETE cascade ON UPDATE no action;