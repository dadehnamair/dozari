CREATE TABLE `guardian_blocks` (
	`child_id` char(36) NOT NULL,
	`blocked_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `guardian_blocks_child_id_blocked_id_pk` PRIMARY KEY(`child_id`,`blocked_id`)
);
--> statement-breakpoint
CREATE TABLE `play_minutes` (
	`user_id` char(36) NOT NULL,
	`day_key` char(10) NOT NULL,
	`minutes` smallint NOT NULL DEFAULT 0,
	CONSTRAINT `play_minutes_user_id_day_key_pk` PRIMARY KEY(`user_id`,`day_key`)
);
--> statement-breakpoint
ALTER TABLE `guardian_blocks` ADD CONSTRAINT `guardian_blocks_child_id_users_id_fk` FOREIGN KEY (`child_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `guardian_blocks` ADD CONSTRAINT `guardian_blocks_blocked_id_users_id_fk` FOREIGN KEY (`blocked_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `play_minutes` ADD CONSTRAINT `play_minutes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;