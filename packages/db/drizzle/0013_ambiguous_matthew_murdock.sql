CREATE TABLE `shop_items` (
	`id` char(36) NOT NULL,
	`title_fa` varchar(80) NOT NULL,
	`description_fa` varchar(300) NOT NULL DEFAULT '',
	`effect` enum('hint_token') NOT NULL,
	`amount` int NOT NULL DEFAULT 1,
	`price_coins` int NOT NULL,
	`min_level` int NOT NULL DEFAULT 1,
	`per_day_limit` int NOT NULL DEFAULT 0,
	`icon_key` varchar(30),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `shop_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_purchases` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`item_id` char(36) NOT NULL,
	`price_coins` int NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `shop_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_inventory` (
	`user_id` char(36) NOT NULL,
	`effect` enum('hint_token') NOT NULL,
	`qty` int NOT NULL DEFAULT 0,
	CONSTRAINT `user_inventory_user_id_effect_pk` PRIMARY KEY(`user_id`,`effect`)
);
--> statement-breakpoint
ALTER TABLE `coin_ledger` MODIFY COLUMN `reason` enum('signup_bonus','daily_login','match_entry','match_payout','match_refund','invite_reward','ugc_reward','admin_adjust','purchase','bot_match_subsidy','price_guess_wager','price_guess_payout','shop_purchase','hint_purchase') NOT NULL;--> statement-breakpoint
ALTER TABLE `shop_purchases` ADD CONSTRAINT `shop_purchases_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_inventory` ADD CONSTRAINT `user_inventory_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `shop_items_sort_idx` ON `shop_items` (`sort_order`);--> statement-breakpoint
CREATE INDEX `shop_purchases_user_idx` ON `shop_purchases` (`user_id`,`created_at`);