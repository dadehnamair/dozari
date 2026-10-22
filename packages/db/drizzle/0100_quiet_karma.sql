ALTER TABLE `bot_groups` ADD `ref` varchar(12);--> statement-breakpoint
ALTER TABLE `user_clients` ADD `src` varchar(16);--> statement-breakpoint
ALTER TABLE `user_clients` ADD `first_src` varchar(16);--> statement-breakpoint
ALTER TABLE `bot_groups` ADD CONSTRAINT `bot_groups_ref_uq` UNIQUE(`ref`);