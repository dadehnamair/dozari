CREATE TABLE `guardian_settings` (
	`child_id` char(36) NOT NULL,
	`chat_mode` enum('friends_text','phrases','off') NOT NULL DEFAULT 'friends_text',
	`friend_approval` enum('auto','ask') NOT NULL DEFAULT 'auto',
	`duels_enabled` boolean NOT NULL DEFAULT true,
	`quiet_from` smallint,
	`quiet_to` smallint,
	`reminder_minutes` smallint,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `guardian_settings_child_id` PRIMARY KEY(`child_id`)
);
--> statement-breakpoint
ALTER TABLE `guardian_settings` ADD CONSTRAINT `guardian_settings_child_id_users_id_fk` FOREIGN KEY (`child_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;