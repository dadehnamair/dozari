CREATE TABLE `keepsake_defs` (
	`id` char(36) NOT NULL,
	`product_id` char(36),
	`title_fa` varchar(120) NOT NULL,
	`story_fa` text NOT NULL,
	`era_year` int,
	`rarity` enum('common','rare','epic','legendary') NOT NULL DEFAULT 'common',
	`pieces` int NOT NULL DEFAULT 4,
	`art_key` varchar(60),
	`set_id` char(36),
	`reward_gems` int NOT NULL DEFAULT 3,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `keepsake_defs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `keepsake_sets` (
	`id` char(36) NOT NULL,
	`title_fa` varchar(120) NOT NULL,
	`reward_gems` int NOT NULL DEFAULT 10,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `keepsake_sets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_keepsake_pieces` (
	`user_id` char(36) NOT NULL,
	`keepsake_id` char(36) NOT NULL,
	`piece` int NOT NULL,
	`source` enum('drop','shop','admin') NOT NULL,
	`ref` varchar(100) NOT NULL,
	`acquired_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_keepsake_pieces_user_id_keepsake_id_piece_pk` PRIMARY KEY(`user_id`,`keepsake_id`,`piece`),
	CONSTRAINT `user_keepsake_pieces_ref_idx` UNIQUE(`user_id`,`ref`)
);
--> statement-breakpoint
CREATE TABLE `user_keepsake_sets` (
	`user_id` char(36) NOT NULL,
	`set_id` char(36) NOT NULL,
	`completed_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_keepsake_sets_user_id_set_id_pk` PRIMARY KEY(`user_id`,`set_id`)
);
--> statement-breakpoint
CREATE TABLE `user_keepsakes` (
	`user_id` char(36) NOT NULL,
	`keepsake_id` char(36) NOT NULL,
	`level` int NOT NULL DEFAULT 1,
	`showcase_slot` int,
	`completed_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_keepsakes_user_id_keepsake_id_pk` PRIMARY KEY(`user_id`,`keepsake_id`)
);
--> statement-breakpoint
ALTER TABLE `coin_ledger` MODIFY COLUMN `reason` enum('signup_bonus','daily_login','match_entry','match_payout','match_refund','invite_reward','ugc_reward','admin_adjust','purchase','bot_match_subsidy','price_guess_wager','price_guess_payout','shop_purchase','hint_purchase','gift_out','gift_in','loan_out','loan_in','repay_out','repay_in','daily_puzzle','tournament_entry','tournament_refund','tournament_prize','match_consolation','broke_rescue','wheel_spin','level_reward','profile_task','birthday_gift','keepsake_piece','keepsake_upgrade') NOT NULL;--> statement-breakpoint
ALTER TABLE `gem_ledger` MODIFY COLUMN `reason` enum('admin_adjust','birthday_gift','wheel_prize','shop_purchase','tournament_entry','tournament_refund','tournament_prize','mission_reward','keepsake_reward') NOT NULL;--> statement-breakpoint
ALTER TABLE `keepsake_defs` ADD CONSTRAINT `keepsake_defs_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `keepsake_defs` ADD CONSTRAINT `keepsake_defs_set_id_keepsake_sets_id_fk` FOREIGN KEY (`set_id`) REFERENCES `keepsake_sets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_keepsake_pieces` ADD CONSTRAINT `user_keepsake_pieces_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_keepsake_pieces` ADD CONSTRAINT `user_keepsake_pieces_keepsake_id_keepsake_defs_id_fk` FOREIGN KEY (`keepsake_id`) REFERENCES `keepsake_defs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_keepsake_sets` ADD CONSTRAINT `user_keepsake_sets_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_keepsake_sets` ADD CONSTRAINT `user_keepsake_sets_set_id_keepsake_sets_id_fk` FOREIGN KEY (`set_id`) REFERENCES `keepsake_sets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_keepsakes` ADD CONSTRAINT `user_keepsakes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_keepsakes` ADD CONSTRAINT `user_keepsakes_keepsake_id_keepsake_defs_id_fk` FOREIGN KEY (`keepsake_id`) REFERENCES `keepsake_defs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `keepsake_defs_set_idx` ON `keepsake_defs` (`set_id`);