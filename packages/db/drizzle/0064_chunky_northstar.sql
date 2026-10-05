CREATE TABLE `lesson_views` (
	`user_id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`first_seen_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`last_seen_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`times` int NOT NULL DEFAULT 1,
	CONSTRAINT `lesson_views_user_id_product_id_pk` PRIMARY KEY(`user_id`,`product_id`)
);
--> statement-breakpoint
ALTER TABLE `lesson_views` ADD CONSTRAINT `lesson_views_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lesson_views` ADD CONSTRAINT `lesson_views_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `lesson_views_user_idx` ON `lesson_views` (`user_id`,`last_seen_at`);