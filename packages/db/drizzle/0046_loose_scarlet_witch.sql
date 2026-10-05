CREATE TABLE `user_cosmetics` (
	`user_id` char(36) NOT NULL,
	`item_id` char(36) NOT NULL,
	`equipped` boolean NOT NULL DEFAULT false,
	`source` varchar(16) NOT NULL DEFAULT 'shop',
	`acquired_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_cosmetics_user_id_item_id_pk` PRIMARY KEY(`user_id`,`item_id`)
);
--> statement-breakpoint
ALTER TABLE `shop_items` MODIFY COLUMN `effect` enum('hint_token','wheel_spin','cosmetic') NOT NULL;--> statement-breakpoint
ALTER TABLE `wheel_prizes` MODIFY COLUMN `kind` enum('coins','gems','hint_token','wheel_spin','cosmetic') NOT NULL;--> statement-breakpoint
ALTER TABLE `shop_items` ADD `slot` enum('hat','outfit','accessory');--> statement-breakpoint
ALTER TABLE `wheel_prizes` ADD `item_id` char(36);--> statement-breakpoint
ALTER TABLE `user_cosmetics` ADD CONSTRAINT `user_cosmetics_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_cosmetics` ADD CONSTRAINT `user_cosmetics_item_id_shop_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `shop_items`(`id`) ON DELETE no action ON UPDATE no action;