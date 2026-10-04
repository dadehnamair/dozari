CREATE TABLE `canned_taunts` (
	`id` char(36) NOT NULL,
	`category_id` char(36) NOT NULL,
	`text` varchar(120) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `canned_taunts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` char(36) NOT NULL,
	`room` enum('city','match') NOT NULL,
	`room_key` varchar(64) NOT NULL,
	`user_id` char(36) NOT NULL,
	`kind` enum('text','taunt') NOT NULL,
	`text` varchar(500) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`deleted_at` datetime(3),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_reports` (
	`id` char(36) NOT NULL,
	`message_id` char(36) NOT NULL,
	`reporter_id` char(36) NOT NULL,
	`reason` varchar(200) NOT NULL DEFAULT '',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`resolved_at` datetime(3),
	CONSTRAINT `chat_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_reports_once_idx` UNIQUE(`message_id`,`reporter_id`)
);
--> statement-breakpoint
CREATE TABLE `taunt_categories` (
	`id` char(36) NOT NULL,
	`name_fa` varchar(40) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `taunt_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `canned_taunts` ADD CONSTRAINT `canned_taunts_category_id_taunt_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `taunt_categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_reports` ADD CONSTRAINT `chat_reports_message_id_chat_messages_id_fk` FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_reports` ADD CONSTRAINT `chat_reports_reporter_id_users_id_fk` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `canned_taunts_category_idx` ON `canned_taunts` (`category_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `chat_messages_room_idx` ON `chat_messages` (`room`,`room_key`,`created_at`);