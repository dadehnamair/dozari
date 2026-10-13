CREATE TABLE `avatar_catalog` (
	`avatar_key` varchar(30) NOT NULL,
	`price_coins` int NOT NULL DEFAULT 0,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `avatar_catalog_avatar_key` PRIMARY KEY(`avatar_key`)
);
--> statement-breakpoint
CREATE TABLE `user_avatars` (
	`user_id` char(36) NOT NULL,
	`avatar_key` varchar(30) NOT NULL,
	`acquired_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_avatars_user_id_avatar_key_pk` PRIMARY KEY(`user_id`,`avatar_key`)
);
--> statement-breakpoint
ALTER TABLE `user_avatars` ADD CONSTRAINT `user_avatars_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT IGNORE INTO `user_avatars` (`user_id`, `avatar_key`) SELECT `id`, `avatar_key` FROM `users` WHERE `avatar_key` LIKE 'char-%';
