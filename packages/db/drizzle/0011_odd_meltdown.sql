CREATE TABLE `admin_users` (
	`id` char(36) NOT NULL,
	`username` varchar(30) NOT NULL,
	`display_name` varchar(60) NOT NULL,
	`password_hash` varchar(200) NOT NULL,
	`role` enum('owner','editor','support','viewer') NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`failed_logins` smallint NOT NULL DEFAULT 0,
	`locked_until` datetime(3),
	`session_version` int NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`last_login_at` datetime(3),
	CONSTRAINT `admin_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_users_username_uq` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `admin_audit_log` ADD `actor` varchar(60);