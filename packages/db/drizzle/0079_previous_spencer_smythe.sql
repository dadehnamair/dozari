ALTER TABLE `tournament_matches` ADD `opens_at` datetime(3);--> statement-breakpoint
ALTER TABLE `tournament_matches` ADD `a_in` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tournament_matches` ADD `b_in` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `round_gap_minutes` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `grace_minutes` int DEFAULT 15 NOT NULL;