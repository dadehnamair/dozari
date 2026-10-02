CREATE TABLE `phone_otps` (
	`user_id` char(36) NOT NULL,
	`phone` varchar(16) NOT NULL,
	`code_hash` char(64) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`sent_at` datetime(3) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `phone_otps_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(16);--> statement-breakpoint
ALTER TABLE `users` ADD `phone_pending` varchar(16);--> statement-breakpoint
ALTER TABLE `users` ADD `phone_verified_at` datetime(3);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_phone_idx` UNIQUE(`phone`);--> statement-breakpoint
ALTER TABLE `phone_otps` ADD CONSTRAINT `phone_otps_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;