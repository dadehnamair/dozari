CREATE TABLE `client_errors` (
	`id` char(36) NOT NULL,
	`user_id` char(36),
	`kind` enum('crash','screen','manual') NOT NULL,
	`screen` varchar(64) NOT NULL DEFAULT '',
	`message` varchar(500) NOT NULL DEFAULT '',
	`detail` text,
	`context` varchar(1500) NOT NULL DEFAULT '',
	`note` varchar(500) NOT NULL DEFAULT '',
	`screenshot` mediumtext,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`resolved_at` datetime(3),
	CONSTRAINT `client_errors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `client_errors` ADD CONSTRAINT `client_errors_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `client_errors_time_idx` ON `client_errors` (`created_at`);--> statement-breakpoint
CREATE INDEX `client_errors_user_idx` ON `client_errors` (`user_id`,`created_at`);