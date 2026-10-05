ALTER TABLE `products` ADD `age_track` enum('kid','teen','adult') DEFAULT 'adult' NOT NULL;--> statement-breakpoint
ALTER TABLE `puzzles` ADD `age_track` enum('kid','teen','adult') DEFAULT 'adult' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `age_track` enum('kid','teen','adult') DEFAULT 'adult' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `age_track_set_at` datetime(3);