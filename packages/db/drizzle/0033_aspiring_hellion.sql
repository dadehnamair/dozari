CREATE TABLE `level_reward_claims` (
	`user_id` char(36) NOT NULL,
	`level` int NOT NULL,
	`claimed_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `level_reward_claims_user_id_level_pk` PRIMARY KEY(`user_id`,`level`)
);
--> statement-breakpoint
ALTER TABLE `coin_ledger` MODIFY COLUMN `reason` enum('signup_bonus','daily_login','match_entry','match_payout','match_refund','invite_reward','ugc_reward','admin_adjust','purchase','bot_match_subsidy','price_guess_wager','price_guess_payout','shop_purchase','hint_purchase','gift_out','gift_in','loan_out','loan_in','repay_out','repay_in','daily_puzzle','tournament_entry','tournament_refund','tournament_prize','match_consolation','broke_rescue','wheel_spin','level_reward') NOT NULL;--> statement-breakpoint
ALTER TABLE `level_reward_claims` ADD CONSTRAINT `level_reward_claims_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;