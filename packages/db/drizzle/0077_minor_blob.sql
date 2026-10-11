CREATE TABLE `ad_placements` (
	`placement` varchar(40) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`reward_kind` enum('coins','gems','hint_token','wheel_spin') NOT NULL DEFAULT 'coins',
	`reward_amount` int NOT NULL DEFAULT 0,
	`daily_cap` int NOT NULL DEFAULT 0,
	`cooldown_seconds` int NOT NULL DEFAULT 60,
	`min_watch_seconds` int NOT NULL DEFAULT 10,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ad_placements_placement` PRIMARY KEY(`placement`)
);
--> statement-breakpoint
CREATE TABLE `ad_views` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`placement` varchar(40) NOT NULL,
	`day` varchar(10) NOT NULL,
	`status` enum('started','rewarded') NOT NULL DEFAULT 'started',
	`reward_kind` enum('coins','gems','hint_token','wheel_spin') NOT NULL,
	`reward_amount` int NOT NULL,
	`min_watch_seconds` int NOT NULL,
	`proof` varchar(400),
	`started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`rewarded_at` datetime(3),
	CONSTRAINT `ad_views_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coin_ledger` MODIFY COLUMN `reason` enum('signup_bonus','daily_login','match_entry','match_payout','match_refund','invite_reward','ugc_reward','admin_adjust','purchase','bot_match_subsidy','price_guess_wager','price_guess_payout','shop_purchase','hint_purchase','gift_out','gift_in','loan_out','loan_in','repay_out','repay_in','daily_puzzle','tournament_entry','tournament_refund','tournament_prize','match_consolation','broke_rescue','wheel_spin','level_reward','profile_task','birthday_gift','keepsake_piece','keepsake_upgrade','ad_reward') NOT NULL;--> statement-breakpoint
ALTER TABLE `gem_ledger` MODIFY COLUMN `reason` enum('admin_adjust','birthday_gift','wheel_prize','shop_purchase','tournament_entry','tournament_refund','tournament_prize','mission_reward','keepsake_reward','ad_reward') NOT NULL;--> statement-breakpoint
ALTER TABLE `ad_views` ADD CONSTRAINT `ad_views_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ad_views_user_day_idx` ON `ad_views` (`user_id`,`placement`,`day`);--> statement-breakpoint
CREATE INDEX `ad_views_user_start_idx` ON `ad_views` (`user_id`,`placement`,`started_at`);