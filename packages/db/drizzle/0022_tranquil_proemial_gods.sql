CREATE TABLE `daily_puzzle_plays` (
	`user_id` char(36) NOT NULL,
	`date_key` char(10) NOT NULL,
	`result` enum('playing','won','lost') NOT NULL DEFAULT 'playing',
	`started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`finished_at` datetime(3),
	CONSTRAINT `daily_puzzle_plays_user_id_date_key_pk` PRIMARY KEY(`user_id`,`date_key`)
);
--> statement-breakpoint
CREATE TABLE `daily_puzzles` (
	`date_key` char(10) NOT NULL,
	`puzzle_id` char(36) NOT NULL,
	`theme_id` char(36),
	`pinned_by` enum('auto','admin') NOT NULL DEFAULT 'auto',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `daily_puzzles_date_key` PRIMARY KEY(`date_key`)
);
--> statement-breakpoint
CREATE TABLE `puzzle_theme_links` (
	`theme_id` char(36) NOT NULL,
	`puzzle_id` char(36) NOT NULL,
	CONSTRAINT `puzzle_theme_links_theme_id_puzzle_id_pk` PRIMARY KEY(`theme_id`,`puzzle_id`)
);
--> statement-breakpoint
CREATE TABLE `puzzle_themes` (
	`id` char(36) NOT NULL,
	`title_fa` varchar(80) NOT NULL,
	`kind` enum('occasion','season','trend','category','custom') NOT NULL DEFAULT 'custom',
	`weight` int NOT NULL DEFAULT 1,
	`start_month` tinyint,
	`start_day` tinyint,
	`end_month` tinyint,
	`end_day` tinyint,
	`from_date` char(10),
	`to_date` char(10),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `puzzle_themes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coin_ledger` MODIFY COLUMN `reason` enum('signup_bonus','daily_login','match_entry','match_payout','match_refund','invite_reward','ugc_reward','admin_adjust','purchase','bot_match_subsidy','price_guess_wager','price_guess_payout','shop_purchase','hint_purchase','gift_out','gift_in','loan_out','loan_in','repay_out','repay_in','daily_puzzle','tournament_entry','tournament_refund','tournament_prize') NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_puzzle_plays` ADD CONSTRAINT `daily_puzzle_plays_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `daily_puzzles` ADD CONSTRAINT `daily_puzzles_puzzle_id_puzzles_id_fk` FOREIGN KEY (`puzzle_id`) REFERENCES `puzzles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `daily_puzzles` ADD CONSTRAINT `daily_puzzles_theme_id_puzzle_themes_id_fk` FOREIGN KEY (`theme_id`) REFERENCES `puzzle_themes`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `puzzle_theme_links` ADD CONSTRAINT `puzzle_theme_links_theme_id_puzzle_themes_id_fk` FOREIGN KEY (`theme_id`) REFERENCES `puzzle_themes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `puzzle_theme_links` ADD CONSTRAINT `puzzle_theme_links_puzzle_id_puzzles_id_fk` FOREIGN KEY (`puzzle_id`) REFERENCES `puzzles`(`id`) ON DELETE cascade ON UPDATE no action;