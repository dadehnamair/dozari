CREATE TABLE `landing_comments` (
	`id` char(36) NOT NULL,
	`target_type` enum('post','cast') NOT NULL,
	`target_key` varchar(120) NOT NULL,
	`author_name` varchar(60) NOT NULL,
	`body` varchar(1000) NOT NULL,
	`status` enum('pending','approved','hidden') NOT NULL DEFAULT 'pending',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `landing_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `landing_comments_target_idx` ON `landing_comments` (`target_type`,`target_key`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `landing_comments_status_idx` ON `landing_comments` (`status`,`created_at`);