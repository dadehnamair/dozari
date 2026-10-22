CREATE TABLE `landing_reviews` (
	`id` char(36) NOT NULL,
	`author_name` varchar(60) NOT NULL,
	`body_fa` text NOT NULL,
	`rating` int,
	`market_fa` varchar(60) NOT NULL,
	`source_url` varchar(300),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `landing_reviews_id` PRIMARY KEY(`id`)
);
