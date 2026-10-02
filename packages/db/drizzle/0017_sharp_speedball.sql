ALTER TABLE `users` ADD `handle` varchar(12);--> statement-breakpoint
ALTER TABLE `users` ADD `findable_by_phone` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_handle_idx` UNIQUE(`handle`);