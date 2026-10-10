CREATE TABLE `backup_runs` (
	`id` char(36) NOT NULL,
	`target_id` char(36) NOT NULL,
	`trigger` enum('schedule','manual') NOT NULL,
	`status` enum('running','ok','failed') NOT NULL DEFAULT 'running',
	`object_key` varchar(400) NOT NULL,
	`size_bytes` bigint unsigned,
	`error` varchar(500),
	`started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`finished_at` datetime(3),
	`deleted_at` datetime(3),
	`deleted_reason` enum('retention','manual'),
	CONSTRAINT `backup_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `backup_targets` (
	`id` char(36) NOT NULL,
	`name` varchar(80) NOT NULL,
	`endpoint` varchar(300) NOT NULL,
	`region` varchar(60) NOT NULL DEFAULT '',
	`bucket` varchar(120) NOT NULL,
	`prefix` varchar(200) NOT NULL DEFAULT '',
	`access_key` varchar(200) NOT NULL,
	`secret_key_enc` varchar(600) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`schedule_kind` enum('hourly','daily','weekly') NOT NULL DEFAULT 'daily',
	`schedule_every_hours` smallint unsigned NOT NULL DEFAULT 24,
	`schedule_time` varchar(5) NOT NULL DEFAULT '03:00',
	`schedule_weekday` tinyint unsigned NOT NULL DEFAULT 0,
	`keep_days` smallint unsigned,
	`keep_count` smallint unsigned,
	`last_scheduled_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `backup_targets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `backup_runs` ADD CONSTRAINT `backup_runs_target_id_backup_targets_id_fk` FOREIGN KEY (`target_id`) REFERENCES `backup_targets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `backup_runs_target_started_idx` ON `backup_runs` (`target_id`,`started_at`);