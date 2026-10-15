CREATE TABLE `trivia_reviews` (
	`submission_id` char(36) NOT NULL,
	`reviewer_id` char(36) NOT NULL,
	`answer_index` tinyint NOT NULL,
	`quality` tinyint NOT NULL,
	`points` int NOT NULL DEFAULT 1,
	`settled_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `trivia_reviews_submission_id_reviewer_id_pk` PRIMARY KEY(`submission_id`,`reviewer_id`)
);
--> statement-breakpoint
CREATE TABLE `trivia_submissions` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`topic_id` char(36) NOT NULL,
	`text_fa` varchar(300) NOT NULL,
	`option_a` varchar(80) NOT NULL,
	`option_b` varchar(80) NOT NULL,
	`option_c` varchar(80) NOT NULL,
	`option_d` varchar(80) NOT NULL,
	`correct_index` tinyint NOT NULL,
	`explanation_fa` varchar(300) NOT NULL DEFAULT '',
	`difficulty` tinyint NOT NULL DEFAULT 2,
	`status` enum('pending','ready_for_review','approved','rejected') NOT NULL DEFAULT 'pending',
	`score` int NOT NULL DEFAULT 0,
	`reviews` int NOT NULL DEFAULT 0,
	`disputes` int NOT NULL DEFAULT 0,
	`reject_reason` enum('wrong_answer','unclear','duplicate','off_topic','bad_taste'),
	`question_id` char(36),
	`reward_coins` int NOT NULL DEFAULT 0,
	`rewarded_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`decided_at` datetime(3),
	CONSTRAINT `trivia_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `trivia_questions` ADD `difficulty` tinyint DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `trivia_questions` ADD `author_id` char(36);--> statement-breakpoint
ALTER TABLE `trivia_questions` ADD `plays` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trivia_questions` ADD `right_count` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trivia_reviews` ADD CONSTRAINT `trivia_reviews_submission_id_trivia_submissions_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `trivia_submissions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trivia_reviews` ADD CONSTRAINT `trivia_reviews_reviewer_id_users_id_fk` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trivia_submissions` ADD CONSTRAINT `trivia_submissions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `trivia_review_user_idx` ON `trivia_reviews` (`reviewer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `trivia_sub_status_idx` ON `trivia_submissions` (`status`,`score`);--> statement-breakpoint
CREATE INDEX `trivia_sub_user_idx` ON `trivia_submissions` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `trivia_questions` ADD CONSTRAINT `trivia_questions_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;