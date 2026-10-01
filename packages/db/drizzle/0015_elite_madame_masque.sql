CREATE TABLE `coin_transfers` (
	`id` char(36) NOT NULL,
	`kind` enum('gift','loan') NOT NULL,
	`status` enum('completed','offered','open','repaid','declined','cancelled') NOT NULL,
	`from_user_id` char(36) NOT NULL,
	`to_user_id` char(36) NOT NULL,
	`amount` int NOT NULL,
	`repaid` int NOT NULL DEFAULT 0,
	`due_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`closed_at` datetime(3),
	CONSTRAINT `coin_transfers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coin_ledger` MODIFY COLUMN `reason` enum('signup_bonus','daily_login','match_entry','match_payout','match_refund','invite_reward','ugc_reward','admin_adjust','purchase','bot_match_subsidy','price_guess_wager','price_guess_payout','shop_purchase','hint_purchase','gift_out','gift_in','loan_out','loan_in','repay_out','repay_in') NOT NULL;--> statement-breakpoint
ALTER TABLE `coin_transfers` ADD CONSTRAINT `coin_transfers_from_user_id_users_id_fk` FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coin_transfers` ADD CONSTRAINT `coin_transfers_to_user_id_users_id_fk` FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `coin_transfers_from_idx` ON `coin_transfers` (`from_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `coin_transfers_to_idx` ON `coin_transfers` (`to_user_id`,`created_at`);