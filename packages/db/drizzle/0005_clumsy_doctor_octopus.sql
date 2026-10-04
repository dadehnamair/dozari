CREATE TABLE `admin_audit_log` (
	`id` char(36) NOT NULL,
	`at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`action` varchar(60) NOT NULL,
	`target` varchar(200) NOT NULL,
	`detail` text,
	CONSTRAINT `admin_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` varchar(100) NOT NULL,
	`value` varchar(500) NOT NULL,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `app_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `bot_runs` (
	`id` char(36) NOT NULL,
	`source_id` char(36),
	`started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`finished_at` datetime(3),
	`status` enum('running','ok','failed') NOT NULL DEFAULT 'running',
	`found_count` int NOT NULL DEFAULT 0,
	`new_count` int NOT NULL DEFAULT 0,
	`error_text` text,
	CONSTRAINT `bot_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_source_options` (
	`source_id` char(36) NOT NULL,
	`key` varchar(60) NOT NULL,
	`value` varchar(500) NOT NULL,
	CONSTRAINT `content_source_options_source_id_key_pk` PRIMARY KEY(`source_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE `content_sources` (
	`id` char(36) NOT NULL,
	`name` varchar(150) NOT NULL,
	`url` varchar(1000) NOT NULL,
	`adapter` enum('html_table','csv','text_lines') NOT NULL,
	`source_type` enum('archive_newspaper','official_list','receipt_photo','website','user_memory','other') NOT NULL DEFAULT 'website',
	`enabled` boolean NOT NULL DEFAULT true,
	`every_hours` smallint NOT NULL DEFAULT 24,
	`last_run_at` datetime(3),
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `content_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_candidates` (
	`id` char(36) NOT NULL,
	`run_id` char(36),
	`source_id` char(36),
	`product_name_fa` varchar(200) NOT NULL,
	`unit_fa` varchar(100),
	`category_guess` enum('car','food','snack','drink','digital','electronics','housing','transport','education','entertainment','clothing','hygiene','service','other'),
	`product_id` char(36),
	`year` smallint NOT NULL,
	`month` smallint,
	`price_rials` bigint NOT NULL,
	`source_url` varchar(1000) NOT NULL,
	`excerpt` text,
	`confidence` smallint NOT NULL DEFAULT 2,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`dedupe_key` varchar(64) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`reviewed_at` datetime(3),
	CONSTRAINT `price_candidates_id` PRIMARY KEY(`id`),
	CONSTRAINT `price_candidates_dedupe_idx` UNIQUE(`dedupe_key`)
);
--> statement-breakpoint
ALTER TABLE `products` ADD `icon_key` varchar(40);--> statement-breakpoint
ALTER TABLE `content_source_options` ADD CONSTRAINT `content_source_options_source_id_content_sources_id_fk` FOREIGN KEY (`source_id`) REFERENCES `content_sources`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_audit_log_at_idx` ON `admin_audit_log` (`at`);--> statement-breakpoint
CREATE INDEX `bot_runs_started_idx` ON `bot_runs` (`started_at`);--> statement-breakpoint
CREATE INDEX `price_candidates_status_idx` ON `price_candidates` (`status`,`created_at`);