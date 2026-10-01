CREATE TABLE `user_notes` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`note` varchar(500) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `ban_reason` varchar(200);--> statement-breakpoint
ALTER TABLE `users` ADD `banned_at` datetime(3);--> statement-breakpoint
ALTER TABLE `users` ADD `sessions_valid_after` datetime(3);--> statement-breakpoint
ALTER TABLE `user_notes` ADD CONSTRAINT `user_notes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `user_notes_user_idx` ON `user_notes` (`user_id`,`created_at`);