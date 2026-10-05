CREATE TABLE `user_clients` (
	`user_id` char(36) NOT NULL,
	`platform` varchar(12) NOT NULL,
	`os_version` varchar(24),
	`app_build` int,
	`store` varchar(12),
	`first_store` varchar(12),
	`first_build` int,
	`first_seen_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_clients_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `user_clients` ADD CONSTRAINT `user_clients_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;