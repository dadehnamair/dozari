CREATE TABLE `bot_group_plays` (
	`chat_id` varchar(40) NOT NULL,
	`date_key` char(10) NOT NULL,
	`result` enum('playing','won','lost') NOT NULL DEFAULT 'playing',
	`mistakes` int NOT NULL DEFAULT 0,
	`solved_groups` int NOT NULL DEFAULT 0,
	`players` int NOT NULL DEFAULT 0,
	`started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`finished_at` datetime(3),
	CONSTRAINT `bot_group_plays_chat_id_date_key_pk` PRIMARY KEY(`chat_id`,`date_key`)
);
--> statement-breakpoint
CREATE TABLE `bot_groups` (
	`chat_id` varchar(40) NOT NULL,
	`platform` enum('bale','telegram') NOT NULL,
	`title` varchar(200) NOT NULL DEFAULT '',
	`added_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`removed_at` datetime(3),
	CONSTRAINT `bot_groups_chat_id` PRIMARY KEY(`chat_id`)
);
--> statement-breakpoint
ALTER TABLE `bot_group_plays` ADD CONSTRAINT `bot_group_plays_chat_id_bot_groups_chat_id_fk` FOREIGN KEY (`chat_id`) REFERENCES `bot_groups`(`chat_id`) ON DELETE cascade ON UPDATE no action;