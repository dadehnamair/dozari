CREATE TABLE `wheel_prizes` (
	`id` char(36) NOT NULL,
	`kind` enum('coins','gems','hint_token','wheel_spin') NOT NULL,
	`amount` int NOT NULL,
	`weight` int NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `wheel_prizes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `wheel_spins` ADD `prize_kind` varchar(16);--> statement-breakpoint
ALTER TABLE `wheel_spins` ADD `prize_amount` int;--> statement-breakpoint
CREATE INDEX `wheel_prizes_sort_idx` ON `wheel_prizes` (`sort_order`);