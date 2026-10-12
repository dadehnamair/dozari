CREATE TABLE `trivia_questions` (
	`id` char(36) NOT NULL,
	`topic_id` char(36) NOT NULL,
	`text_fa` varchar(300) NOT NULL,
	`option_a` varchar(80) NOT NULL,
	`option_b` varchar(80) NOT NULL,
	`option_c` varchar(80) NOT NULL,
	`option_d` varchar(80) NOT NULL,
	`correct_index` tinyint NOT NULL,
	`explanation_fa` varchar(300) NOT NULL DEFAULT '',
	`age_track` enum('kid','teen','adult') NOT NULL DEFAULT 'adult',
	`status` enum('draft','approved','retired') NOT NULL DEFAULT 'approved',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `trivia_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `trivia_topic_idx` ON `trivia_questions` (`topic_id`,`status`);