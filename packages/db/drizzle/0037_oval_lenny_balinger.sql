ALTER TABLE `xp_events` ADD `mode` enum('solo','duel');--> statement-breakpoint
ALTER TABLE `xp_events` ADD `outcome` enum('win','loss','draw');