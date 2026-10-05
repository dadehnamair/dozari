CREATE TABLE `sponsors` (
	`id` char(36) NOT NULL,
	`name_fa` varchar(60) NOT NULL,
	`tagline_fa` varchar(120) NOT NULL DEFAULT '',
	`description_fa` text NOT NULL,
	`banner_url` varchar(300),
	`logo_url` varchar(300),
	`link_url` varchar(300),
	`accent` varchar(7),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `sponsors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tournaments` ADD `sponsor_id` char(36);