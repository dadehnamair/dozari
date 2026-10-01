CREATE TABLE `coin_ledger` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`delta` int NOT NULL,
	`reason` enum('signup_bonus','daily_login','match_entry','match_payout','match_refund','invite_reward','ugc_reward','admin_adjust','purchase','bot_match_subsidy','price_guess_wager','price_guess_payout') NOT NULL,
	`ref_type` varchar(30),
	`ref_id` varchar(64),
	`idempotency_key` varchar(150) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `coin_ledger_id` PRIMARY KEY(`id`),
	CONSTRAINT `coin_ledger_idempotency_key_idx` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `daily_reward_steps` (
	`day` smallint NOT NULL,
	`coins` int NOT NULL,
	CONSTRAINT `daily_reward_steps_day` PRIMARY KEY(`day`)
);
--> statement-breakpoint
CREATE TABLE `user_balances` (
	`user_id` char(36) NOT NULL,
	`balance` int NOT NULL DEFAULT 0,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_balances_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `user_daily_rewards` (
	`user_id` char(36) NOT NULL,
	`last_claimed_at` datetime(3) NOT NULL,
	`streak_day` smallint NOT NULL,
	`claims_total` int NOT NULL DEFAULT 0,
	CONSTRAINT `user_daily_rewards_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `coin_ledger` ADD CONSTRAINT `coin_ledger_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_balances` ADD CONSTRAINT `user_balances_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_daily_rewards` ADD CONSTRAINT `user_daily_rewards_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `coin_ledger_user_idx` ON `coin_ledger` (`user_id`,`created_at`);