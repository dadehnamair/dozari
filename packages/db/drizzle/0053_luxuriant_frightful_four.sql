CREATE TABLE `ugc_submissions` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`kind` enum('item','price_point','price_report') NOT NULL,
	`status` enum('pending','ready_for_review','approved','rejected') NOT NULL DEFAULT 'pending',
	`product_id` char(36),
	`name_fa` varchar(200) NOT NULL DEFAULT '',
	`category` varchar(40),
	`unit_fa` varchar(100),
	`year` smallint,
	`price_rials` bigint,
	`source_type` enum('website','user_memory','other') NOT NULL DEFAULT 'user_memory',
	`source_text` varchar(300) NOT NULL DEFAULT '',
	`note` varchar(500) NOT NULL DEFAULT '',
	`score` int NOT NULL DEFAULT 0,
	`rewarded_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`decided_at` datetime(3),
	CONSTRAINT `ugc_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ugc_votes` (
	`submission_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`value` tinyint NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ugc_votes_submission_id_user_id_pk` PRIMARY KEY(`submission_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `user_reports` (
	`id` char(36) NOT NULL,
	`reporter_id` char(36) NOT NULL,
	`target_id` char(36) NOT NULL,
	`category` enum('abuse','spam','cheating','bad_name','other') NOT NULL,
	`details` varchar(500) NOT NULL DEFAULT '',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`resolved_at` datetime(3),
	CONSTRAINT `user_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ugc_submissions` ADD CONSTRAINT `ugc_submissions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ugc_votes` ADD CONSTRAINT `ugc_votes_submission_id_ugc_submissions_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `ugc_submissions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ugc_votes` ADD CONSTRAINT `ugc_votes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_reports` ADD CONSTRAINT `user_reports_reporter_id_users_id_fk` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_reports` ADD CONSTRAINT `user_reports_target_id_users_id_fk` FOREIGN KEY (`target_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ugc_submissions_status_idx` ON `ugc_submissions` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `ugc_submissions_user_idx` ON `ugc_submissions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `user_reports_target_idx` ON `user_reports` (`target_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `user_reports_reporter_idx` ON `user_reports` (`reporter_id`,`created_at`);