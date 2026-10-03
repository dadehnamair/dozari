ALTER TABLE `shop_items` MODIFY COLUMN `effect` enum('hint_token','wheel_spin') NOT NULL;--> statement-breakpoint
ALTER TABLE `user_inventory` MODIFY COLUMN `effect` enum('hint_token','wheel_spin') NOT NULL;--> statement-breakpoint
ALTER TABLE `wheel_spins` MODIFY COLUMN `match_id` char(36);--> statement-breakpoint
ALTER TABLE `level_road` ADD `reward_spins` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tournament_prizes` ADD `spins` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `wheel_spins` ADD `source` varchar(16) DEFAULT 'win' NOT NULL;--> statement-breakpoint
ALTER TABLE `wheel_spins` ADD `ref` varchar(80);--> statement-breakpoint
ALTER TABLE `wheel_spins` ADD CONSTRAINT `wheel_spins_user_ref` UNIQUE(`user_id`,`source`,`ref`);