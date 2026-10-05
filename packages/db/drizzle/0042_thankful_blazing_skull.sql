CREATE TABLE `gem_ledger` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`delta` int NOT NULL,
	`reason` enum('admin_adjust','birthday_gift','wheel_prize','shop_purchase','tournament_entry','tournament_refund','tournament_prize','mission_reward') NOT NULL,
	`ref_type` varchar(30),
	`ref_id` varchar(64),
	`idempotency_key` varchar(150) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `gem_ledger_id` PRIMARY KEY(`id`),
	CONSTRAINT `gem_ledger_idempotency_key_idx` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `user_gems` (
	`user_id` char(36) NOT NULL,
	`balance` int NOT NULL DEFAULT 0,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_gems_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `gem_ledger` ADD CONSTRAINT `gem_ledger_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_gems` ADD CONSTRAINT `user_gems_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `gem_ledger_user_idx` ON `gem_ledger` (`user_id`,`created_at`);