CREATE TABLE `account_delete_codes` (
	`user_id` char(36) NOT NULL,
	`code_hash` char(64) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`sent_at` datetime(3) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `account_delete_codes_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `account_delete_codes` ADD CONSTRAINT `account_delete_codes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;