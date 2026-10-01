CREATE TABLE `admin_message_channels` (
	`message_id` char(36) NOT NULL,
	`channel` enum('in_app','bale','sms','email','push') NOT NULL,
	`recipients` int NOT NULL DEFAULT 0,
	CONSTRAINT `admin_message_channels_message_id_channel_pk` PRIMARY KEY(`message_id`,`channel`)
);
--> statement-breakpoint
CREATE TABLE `admin_messages` (
	`id` char(36) NOT NULL,
	`title` varchar(150) NOT NULL,
	`body` text NOT NULL,
	`audience` enum('all','bale_linked','user') NOT NULL,
	`target_user_id` char(36),
	`sent_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`retracted_at` datetime(3),
	CONSTRAINT `admin_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inbox_messages` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`message_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`read_at` datetime(3),
	CONSTRAINT `inbox_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `admin_message_channels` ADD CONSTRAINT `admin_message_channels_message_id_admin_messages_id_fk` FOREIGN KEY (`message_id`) REFERENCES `admin_messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inbox_messages` ADD CONSTRAINT `inbox_messages_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inbox_messages` ADD CONSTRAINT `inbox_messages_message_id_admin_messages_id_fk` FOREIGN KEY (`message_id`) REFERENCES `admin_messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_messages_sent_idx` ON `admin_messages` (`sent_at`);--> statement-breakpoint
CREATE INDEX `inbox_messages_user_idx` ON `inbox_messages` (`user_id`,`created_at`);