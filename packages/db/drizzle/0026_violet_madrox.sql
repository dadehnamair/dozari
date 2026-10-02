CREATE TABLE `daily_play_counts` (
	`user_id` char(36) NOT NULL,
	`date_key` char(10) NOT NULL,
	`mode` enum('solo','duel') NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	CONSTRAINT `daily_play_counts_user_id_date_key_mode_pk` PRIMARY KEY(`user_id`,`date_key`,`mode`)
);
--> statement-breakpoint
ALTER TABLE `daily_play_counts` ADD CONSTRAINT `daily_play_counts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;