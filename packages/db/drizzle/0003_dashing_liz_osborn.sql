CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`device_id` varchar(64),
	`nickname` varchar(60) NOT NULL,
	`avatar_key` varchar(30) NOT NULL,
	`is_banned` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`last_seen_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_device_id_idx` UNIQUE(`device_id`)
);
