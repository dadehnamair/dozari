CREATE TABLE `guardian_link_codes` (
	`code` char(6) NOT NULL,
	`child_id` char(36) NOT NULL,
	`guardian_id` char(36) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `guardian_link_codes_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `guardian_links` (
	`child_id` char(36) NOT NULL,
	`guardian_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `guardian_links_child_id` PRIMARY KEY(`child_id`)
);
--> statement-breakpoint
ALTER TABLE `guardian_link_codes` ADD CONSTRAINT `guardian_link_codes_child_id_users_id_fk` FOREIGN KEY (`child_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `guardian_link_codes` ADD CONSTRAINT `guardian_link_codes_guardian_id_users_id_fk` FOREIGN KEY (`guardian_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `guardian_links` ADD CONSTRAINT `guardian_links_child_id_users_id_fk` FOREIGN KEY (`child_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `guardian_links` ADD CONSTRAINT `guardian_links_guardian_id_users_id_fk` FOREIGN KEY (`guardian_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `guardian_links_guardian_idx` ON `guardian_links` (`guardian_id`);