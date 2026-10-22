CREATE TABLE `bot_group_scores` (
	`chat_id` varchar(40) NOT NULL,
	`week_key` char(10) NOT NULL,
	`user_ref` varchar(40) NOT NULL,
	`name` varchar(100) NOT NULL DEFAULT '',
	`points` int NOT NULL DEFAULT 0,
	`groups` int NOT NULL DEFAULT 0,
	`wrong` int NOT NULL DEFAULT 0,
	CONSTRAINT `bot_group_scores_chat_id_week_key_user_ref_pk` PRIMARY KEY(`chat_id`,`week_key`,`user_ref`)
);
--> statement-breakpoint
ALTER TABLE `bot_group_scores` ADD CONSTRAINT `bot_group_scores_chat_id_bot_groups_chat_id_fk` FOREIGN KEY (`chat_id`) REFERENCES `bot_groups`(`chat_id`) ON DELETE cascade ON UPDATE no action;