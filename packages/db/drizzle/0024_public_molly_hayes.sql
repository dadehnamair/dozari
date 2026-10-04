CREATE TABLE `coin_packages` (
	`id` char(36) NOT NULL,
	`title_fa` varchar(80) NOT NULL,
	`coins` int NOT NULL,
	`price_rials` bigint NOT NULL,
	`sku_bazaar` varchar(80),
	`sku_myket` varchar(80),
	`min_level` int NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT false,
	CONSTRAINT `coin_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coin_purchases` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`package_id` char(36) NOT NULL,
	`store` enum('bazaar','myket') NOT NULL,
	`store_order_id` varchar(120) NOT NULL,
	`coins` int NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `coin_purchases_id` PRIMARY KEY(`id`),
	CONSTRAINT `coin_purchases_order_idx` UNIQUE(`store`,`store_order_id`)
);
--> statement-breakpoint
ALTER TABLE `coin_purchases` ADD CONSTRAINT `coin_purchases_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coin_purchases` ADD CONSTRAINT `coin_purchases_package_id_coin_packages_id_fk` FOREIGN KEY (`package_id`) REFERENCES `coin_packages`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `coin_packages_sort_idx` ON `coin_packages` (`sort_order`);