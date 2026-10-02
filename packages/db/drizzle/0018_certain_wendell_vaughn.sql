CREATE TABLE `badges` (
	`id` char(36) NOT NULL,
	`slug` varchar(40) NOT NULL,
	`title_fa` varchar(60) NOT NULL,
	`description_fa` varchar(200) NOT NULL DEFAULT '',
	`kind` enum('badge','medal') NOT NULL DEFAULT 'badge',
	`icon_key` varchar(30),
	`perk` enum('none','share_contact','moderator') NOT NULL DEFAULT 'none',
	`rule_metric` enum('none','games','wins','level') NOT NULL DEFAULT 'none',
	`rule_min` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `badges_id` PRIMARY KEY(`id`),
	CONSTRAINT `badges_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `chat_mutes` (
	`user_id` char(36) NOT NULL,
	`until` datetime(3) NOT NULL,
	`reason` varchar(200) NOT NULL DEFAULT '',
	`issuer_type` enum('admin','agent') NOT NULL,
	`issuer_id` char(36),
	CONSTRAINT `chat_mutes_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `mod_actions` (
	`id` char(36) NOT NULL,
	`agent_id` char(36) NOT NULL,
	`target_id` char(36) NOT NULL,
	`action` enum('warn','mute') NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `mod_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_badges` (
	`user_id` char(36) NOT NULL,
	`badge_id` char(36) NOT NULL,
	`awarded_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`awarded_by` varchar(40),
	CONSTRAINT `user_badges_user_id_badge_id_pk` PRIMARY KEY(`user_id`,`badge_id`)
);
--> statement-breakpoint
CREATE TABLE `user_notices` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`kind` enum('warning','commendation') NOT NULL,
	`text` varchar(300) NOT NULL,
	`issuer_type` enum('admin','agent') NOT NULL,
	`issuer_id` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`read_at` datetime(3),
	CONSTRAINT `user_notices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `equipped_badge_id` char(36);--> statement-breakpoint
ALTER TABLE `chat_mutes` ADD CONSTRAINT `chat_mutes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_badges` ADD CONSTRAINT `user_badges_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_badges` ADD CONSTRAINT `user_badges_badge_id_badges_id_fk` FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_notices` ADD CONSTRAINT `user_notices_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mod_actions_agent_idx` ON `mod_actions` (`agent_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `user_notices_user_idx` ON `user_notices` (`user_id`,`created_at`);