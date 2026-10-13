CREATE TABLE `fcm_tokens` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`token` varchar(400) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `fcm_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `fcm_token_uq` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `fcm_tokens` ADD CONSTRAINT `fcm_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `fcm_user_idx` ON `fcm_tokens` (`user_id`);