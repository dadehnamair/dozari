CREATE TABLE `bale_link_codes` (
	`code` varchar(12) NOT NULL,
	`user_id` char(36) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `bale_link_codes_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `bale_links` (
	`user_id` char(36) NOT NULL,
	`chat_id` varchar(40) NOT NULL,
	`linked_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`daily_notified_for` datetime(3),
	CONSTRAINT `bale_links_user_id` PRIMARY KEY(`user_id`),
	CONSTRAINT `bale_links_chat_uq` UNIQUE(`chat_id`)
);
--> statement-breakpoint
CREATE TABLE `notification_outbox` (
	`id` char(36) NOT NULL,
	`chat_id` varchar(40) NOT NULL,
	`user_id` char(36),
	`kind` varchar(40) NOT NULL,
	`text` text NOT NULL,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`attempts` smallint NOT NULL DEFAULT 0,
	`last_error` varchar(300),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`sent_at` datetime(3),
	CONSTRAINT `notification_outbox_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `bale_link_codes` ADD CONSTRAINT `bale_link_codes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bale_links` ADD CONSTRAINT `bale_links_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `notification_outbox_status_idx` ON `notification_outbox` (`status`,`created_at`);