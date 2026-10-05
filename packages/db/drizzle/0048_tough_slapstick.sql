CREATE TABLE `shop_real_purchases` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`item_id` char(36) NOT NULL,
	`store` enum('bazaar','myket','bale') NOT NULL,
	`store_order_id` varchar(120) NOT NULL,
	`rials` bigint NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `shop_real_purchases_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_real_purchases_order_idx` UNIQUE(`store`,`store_order_id`)
);
--> statement-breakpoint
ALTER TABLE `shop_items` ADD `price_rials` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shop_items` ADD `sku_bazaar` varchar(80);--> statement-breakpoint
ALTER TABLE `shop_items` ADD `sku_myket` varchar(80);--> statement-breakpoint
ALTER TABLE `shop_real_purchases` ADD CONSTRAINT `shop_real_purchases_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_real_purchases` ADD CONSTRAINT `shop_real_purchases_item_id_shop_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `shop_items`(`id`) ON DELETE no action ON UPDATE no action;