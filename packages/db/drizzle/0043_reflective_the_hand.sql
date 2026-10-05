ALTER TABLE `shop_items` ADD `currency` enum('coins','gems') DEFAULT 'coins' NOT NULL;--> statement-breakpoint
ALTER TABLE `shop_items` ADD `price_gems` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shop_purchases` ADD `price_gems` int DEFAULT 0 NOT NULL;