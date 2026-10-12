CREATE TABLE `match_leaves` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`match_id` char(36),
	`kind` enum('manual','absent') NOT NULL,
	`left_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `match_leaves_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `match_leaves_user_idx` ON `match_leaves` (`user_id`,`left_at`);