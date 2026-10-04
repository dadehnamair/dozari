CREATE TABLE `friendships` (
	`user_low` char(36) NOT NULL,
	`user_high` char(36) NOT NULL,
	`requested_by` char(36) NOT NULL,
	`status` enum('pending','accepted') NOT NULL DEFAULT 'pending',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`responded_at` datetime(3),
	CONSTRAINT `friendships_user_low_user_high_pk` PRIMARY KEY(`user_low`,`user_high`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `gender` enum('female','male');--> statement-breakpoint
ALTER TABLE `friendships` ADD CONSTRAINT `friendships_user_low_users_id_fk` FOREIGN KEY (`user_low`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `friendships` ADD CONSTRAINT `friendships_user_high_users_id_fk` FOREIGN KEY (`user_high`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `friendships_high_idx` ON `friendships` (`user_high`);