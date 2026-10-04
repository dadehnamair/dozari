CREATE TABLE `phone_conflicts` (
	`user_id` char(36) NOT NULL,
	`phone` varchar(16) NOT NULL,
	`holder_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `phone_conflicts_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `phone_conflicts` ADD CONSTRAINT `phone_conflicts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `phone_conflicts` ADD CONSTRAINT `phone_conflicts_holder_id_users_id_fk` FOREIGN KEY (`holder_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;