CREATE TABLE `item_lessons` (
	`product_id` char(36) NOT NULL,
	`word_fa` varchar(60) NOT NULL,
	`story_fa` varchar(300) NOT NULL DEFAULT '',
	`syllables_fa` varchar(80),
	`status` enum('draft','approved') NOT NULL DEFAULT 'draft',
	`reviewed_by` char(36),
	`reviewed_at` datetime(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `item_lessons_product_id` PRIMARY KEY(`product_id`)
);
--> statement-breakpoint
ALTER TABLE `item_lessons` ADD CONSTRAINT `item_lessons_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;