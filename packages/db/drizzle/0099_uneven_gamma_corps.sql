CREATE TABLE `bot_group_price_sessions` (
	`chat_id` varchar(40) NOT NULL,
	`date_key` char(10) NOT NULL,
	`sessions` int NOT NULL DEFAULT 0,
	CONSTRAINT `bot_group_price_sessions_chat_id_date_key_pk` PRIMARY KEY(`chat_id`,`date_key`)
);
--> statement-breakpoint
ALTER TABLE `bot_group_price_sessions` ADD CONSTRAINT `bot_group_price_sessions_chat_id_bot_groups_chat_id_fk` FOREIGN KEY (`chat_id`) REFERENCES `bot_groups`(`chat_id`) ON DELETE cascade ON UPDATE no action;