CREATE TABLE `blocked_words` (
	`id` char(36) NOT NULL,
	`word` varchar(100) NOT NULL,
	`severity` enum('block','mask') NOT NULL DEFAULT 'block',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `blocked_words_id` PRIMARY KEY(`id`),
	CONSTRAINT `blocked_words_word_uq` UNIQUE(`word`)
);
