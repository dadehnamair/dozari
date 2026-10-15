CREATE TABLE `web_push_subscriptions` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`endpoint` varchar(700) NOT NULL,
	`p256dh` varchar(200) NOT NULL,
	`auth` varchar(100) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `web_push_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `web_push_endpoint_uq` UNIQUE(`endpoint`)
);
--> statement-breakpoint
ALTER TABLE `web_push_subscriptions` ADD CONSTRAINT `web_push_subscriptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `web_push_user_idx` ON `web_push_subscriptions` (`user_id`);