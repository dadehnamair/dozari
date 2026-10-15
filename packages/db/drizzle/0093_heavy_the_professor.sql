CREATE TABLE `trivia_seen` (
	`user_id` char(36) NOT NULL,
	`question_id` char(36) NOT NULL,
	`seen_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `trivia_seen_user_id_question_id_pk` PRIMARY KEY(`user_id`,`question_id`)
);
--> statement-breakpoint
ALTER TABLE `trivia_seen` ADD CONSTRAINT `trivia_seen_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trivia_seen` ADD CONSTRAINT `trivia_seen_question_id_trivia_questions_id_fk` FOREIGN KEY (`question_id`) REFERENCES `trivia_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `trivia_seen_user_idx` ON `trivia_seen` (`user_id`,`seen_at`);