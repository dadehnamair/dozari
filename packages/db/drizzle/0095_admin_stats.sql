CREATE TABLE `puzzle_plays` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`puzzle_id` char(36) NOT NULL,
	`mode` enum('solo','daily','duel','team') NOT NULL,
	`outcome` enum('win','loss','draw') NOT NULL,
	`groups_solved` tinyint NOT NULL DEFAULT 0,
	`mistakes` smallint NOT NULL DEFAULT 0,
	`hints_used` smallint NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `puzzle_plays_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user_clients` ADD `pwa` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user_clients` ADD `first_pwa` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `puzzle_plays` ADD CONSTRAINT `puzzle_plays_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `puzzle_plays_time_idx` ON `puzzle_plays` (`created_at`);--> statement-breakpoint
CREATE INDEX `puzzle_plays_user_idx` ON `puzzle_plays` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `puzzle_plays_puzzle_idx` ON `puzzle_plays` (`puzzle_id`);