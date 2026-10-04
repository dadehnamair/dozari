CREATE TABLE `xp_events` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`xp` int NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `xp_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `xp_events` ADD CONSTRAINT `xp_events_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `xp_events_time_idx` ON `xp_events` (`created_at`,`user_id`);--> statement-breakpoint
CREATE INDEX `xp_events_user_idx` ON `xp_events` (`user_id`,`created_at`);