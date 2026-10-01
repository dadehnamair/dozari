CREATE TABLE `cities` (
	`id` char(36) NOT NULL,
	`slug` varchar(40) NOT NULL,
	`name_fa` varchar(60) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `cities_id` PRIMARY KEY(`id`),
	CONSTRAINT `cities_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `user_stats` (
	`user_id` char(36) NOT NULL,
	`xp` int NOT NULL DEFAULT 0,
	`games` int NOT NULL DEFAULT 0,
	`wins` int NOT NULL DEFAULT 0,
	`losses` int NOT NULL DEFAULT 0,
	`draws` int NOT NULL DEFAULT 0,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_stats_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `city_id` char(36);--> statement-breakpoint
ALTER TABLE `users` ADD `email` varchar(120);--> statement-breakpoint
ALTER TABLE `user_stats` ADD CONSTRAINT `user_stats_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;