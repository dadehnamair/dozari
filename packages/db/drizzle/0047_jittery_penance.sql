CREATE TABLE `birthday_claims` (
	`user_id` char(36) NOT NULL,
	`year` smallint NOT NULL,
	`claimed_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `birthday_claims_user_id_year_pk` PRIMARY KEY(`user_id`,`year`)
);
--> statement-breakpoint
CREATE TABLE `birthday_notices` (
	`user_id` char(36) NOT NULL,
	`year` smallint NOT NULL,
	`stage` enum('week','day') NOT NULL,
	`sent_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `birthday_notices_user_id_year_stage_pk` PRIMARY KEY(`user_id`,`year`,`stage`)
);
--> statement-breakpoint
ALTER TABLE `coin_ledger` MODIFY COLUMN `reason` enum('signup_bonus','daily_login','match_entry','match_payout','match_refund','invite_reward','ugc_reward','admin_adjust','purchase','bot_match_subsidy','price_guess_wager','price_guess_payout','shop_purchase','hint_purchase','gift_out','gift_in','loan_out','loan_in','repay_out','repay_in','daily_puzzle','tournament_entry','tournament_refund','tournament_prize','match_consolation','broke_rescue','wheel_spin','level_reward','profile_task','birthday_gift') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `birth_year` smallint;--> statement-breakpoint
ALTER TABLE `users` ADD `birth_month` tinyint;--> statement-breakpoint
ALTER TABLE `users` ADD `birth_day` tinyint;--> statement-breakpoint
ALTER TABLE `users` ADD `show_age` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_birthday` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `birthday_claims` ADD CONSTRAINT `birthday_claims_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `birthday_notices` ADD CONSTRAINT `birthday_notices_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;