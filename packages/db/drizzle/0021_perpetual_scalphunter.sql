CREATE TABLE `bot_players` (
	`user_id` char(36) NOT NULL,
	`skill` int NOT NULL DEFAULT 50,
	`think_min_ms` int NOT NULL DEFAULT 3000,
	`think_max_ms` int NOT NULL DEFAULT 12000,
	`taunt_percent` int NOT NULL DEFAULT 40,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `bot_players_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `tournaments` ADD `bot_fill` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `is_bot` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `bot_players` ADD CONSTRAINT `bot_players_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;