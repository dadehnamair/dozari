CREATE TABLE `invite_codes` (
	`code` varchar(12) NOT NULL,
	`owner_id` char(36),
	`label` varchar(80),
	`max_uses` int NOT NULL,
	`uses` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `invite_codes_code` PRIMARY KEY(`code`),
	CONSTRAINT `invite_codes_owner_idx` UNIQUE(`owner_id`)
);
--> statement-breakpoint
CREATE TABLE `invite_redemptions` (
	`invitee_id` char(36) NOT NULL,
	`code` varchar(12) NOT NULL,
	`inviter_id` char(36),
	`redeemed_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`reward_paid_at` datetime(3),
	CONSTRAINT `invite_redemptions_invitee_id` PRIMARY KEY(`invitee_id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `chat_unlocked_at` datetime(3);--> statement-breakpoint
ALTER TABLE `invite_redemptions` ADD CONSTRAINT `invite_redemptions_invitee_id_users_id_fk` FOREIGN KEY (`invitee_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `invite_redemptions_inviter_idx` ON `invite_redemptions` (`inviter_id`);