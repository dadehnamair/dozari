ALTER TABLE `tournament_entries` ADD `paid_gems` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `entry_gems` int DEFAULT 0 NOT NULL;