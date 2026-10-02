CREATE TABLE `tournament_entries` (
	`tournament_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`joined_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`paid` int NOT NULL DEFAULT 0,
	CONSTRAINT `tournament_entries_tournament_id_user_id_pk` PRIMARY KEY(`tournament_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `tournament_matches` (
	`id` char(36) NOT NULL,
	`tournament_id` char(36) NOT NULL,
	`round` int NOT NULL,
	`slot` int NOT NULL,
	`player_a` char(36),
	`player_b` char(36),
	`winner_id` char(36),
	`status` enum('waiting','ready','playing','done','bye') NOT NULL DEFAULT 'waiting',
	CONSTRAINT `tournament_matches_id` PRIMARY KEY(`id`),
	CONSTRAINT `tournament_matches_slot_idx` UNIQUE(`tournament_id`,`round`,`slot`)
);
--> statement-breakpoint
CREATE TABLE `tournament_prizes` (
	`tournament_id` char(36) NOT NULL,
	`place` int NOT NULL,
	`coins` int NOT NULL,
	CONSTRAINT `tournament_prizes_tournament_id_place_pk` PRIMARY KEY(`tournament_id`,`place`)
);
--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` char(36) NOT NULL,
	`title_fa` varchar(80) NOT NULL,
	`description_fa` text NOT NULL,
	`icon_key` varchar(30),
	`status` enum('draft','open','running','finished','cancelled') NOT NULL DEFAULT 'draft',
	`size` int NOT NULL,
	`min_players` int NOT NULL DEFAULT 4,
	`entry_coins` int NOT NULL DEFAULT 0,
	`min_level` int NOT NULL DEFAULT 1,
	`starts_at` datetime(3) NOT NULL,
	`started_at` datetime(3),
	`finished_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `tournaments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coin_ledger` MODIFY COLUMN `reason` enum('signup_bonus','daily_login','match_entry','match_payout','match_refund','invite_reward','ugc_reward','admin_adjust','purchase','bot_match_subsidy','price_guess_wager','price_guess_payout','shop_purchase','hint_purchase','gift_out','gift_in','loan_out','loan_in','repay_out','repay_in','tournament_entry','tournament_refund','tournament_prize') NOT NULL;--> statement-breakpoint
ALTER TABLE `tournament_entries` ADD CONSTRAINT `tournament_entries_tournament_id_tournaments_id_fk` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tournament_entries` ADD CONSTRAINT `tournament_entries_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tournament_matches` ADD CONSTRAINT `tournament_matches_tournament_id_tournaments_id_fk` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tournament_prizes` ADD CONSTRAINT `tournament_prizes_tournament_id_tournaments_id_fk` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `tournaments_status_idx` ON `tournaments` (`status`,`starts_at`);