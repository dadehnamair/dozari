CREATE TABLE `wheel_spins` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`match_id` char(36) NOT NULL,
	`coins` int,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`spun_at` datetime(3),
	CONSTRAINT `wheel_spins_id` PRIMARY KEY(`id`),
	CONSTRAINT `wheel_spins_user_match` UNIQUE(`user_id`,`match_id`)
);
--> statement-breakpoint
ALTER TABLE `coin_ledger` MODIFY COLUMN `reason` enum('signup_bonus','daily_login','match_entry','match_payout','match_refund','invite_reward','ugc_reward','admin_adjust','purchase','bot_match_subsidy','price_guess_wager','price_guess_payout','shop_purchase','hint_purchase','gift_out','gift_in','loan_out','loan_in','repay_out','repay_in','daily_puzzle','tournament_entry','tournament_refund','tournament_prize','match_consolation','broke_rescue','wheel_spin') NOT NULL;--> statement-breakpoint
ALTER TABLE `wheel_spins` ADD CONSTRAINT `wheel_spins_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `wheel_spins_pending` ON `wheel_spins` (`user_id`,`spun_at`);