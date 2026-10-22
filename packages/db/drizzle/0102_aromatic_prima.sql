CREATE TABLE `group_rewards` (
	`user_id` char(36) NOT NULL,
	`date_key` char(10) NOT NULL,
	`points` int NOT NULL DEFAULT 0,
	`coins` int NOT NULL DEFAULT 0,
	`xp` int NOT NULL DEFAULT 0,
	CONSTRAINT `group_rewards_user_id_date_key_pk` PRIMARY KEY(`user_id`,`date_key`)
);
--> statement-breakpoint
ALTER TABLE `coin_ledger` MODIFY COLUMN `reason` enum('signup_bonus','daily_login','match_entry','match_payout','match_refund','invite_reward','ugc_reward','admin_adjust','purchase','bot_match_subsidy','price_guess_wager','price_guess_payout','shop_purchase','hint_purchase','gift_out','gift_in','loan_out','loan_in','repay_out','repay_in','daily_puzzle','tournament_entry','tournament_refund','tournament_prize','match_consolation','broke_rescue','wheel_spin','level_reward','profile_task','birthday_gift','keepsake_piece','keepsake_upgrade','ad_reward','trivia_entry','trivia_payout','trivia_refund','group_play') NOT NULL;--> statement-breakpoint
ALTER TABLE `bot_group_scores` ADD `user_id` char(36);--> statement-breakpoint
ALTER TABLE `group_rewards` ADD CONSTRAINT `group_rewards_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `bot_group_scores_user_idx` ON `bot_group_scores` (`user_id`);