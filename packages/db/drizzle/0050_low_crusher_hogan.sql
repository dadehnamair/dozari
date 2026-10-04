CREATE TABLE `landing_cast` (
	`id` char(36) NOT NULL,
	`name_fa` varchar(80) NOT NULL,
	`role_fa` varchar(120) NOT NULL DEFAULT '',
	`bio_fa` text NOT NULL,
	`image_key` varchar(200),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `landing_cast_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `landing_faq` (
	`id` char(36) NOT NULL,
	`question_fa` varchar(200) NOT NULL,
	`answer_fa` text NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `landing_faq_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `landing_posts` (
	`id` char(36) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`title_fa` varchar(160) NOT NULL,
	`summary_fa` varchar(400) NOT NULL DEFAULT '',
	`body_md` text NOT NULL,
	`meta_title` varchar(70),
	`meta_description` varchar(200),
	`cover_url` varchar(300),
	`author_name` varchar(80) NOT NULL DEFAULT '',
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`published_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `landing_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `landing_posts_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `landing_slug_redirects` (
	`old_slug` varchar(120) NOT NULL,
	`post_id` char(36) NOT NULL,
	CONSTRAINT `landing_slug_redirects_old_slug` PRIMARY KEY(`old_slug`)
);
--> statement-breakpoint
ALTER TABLE `landing_slug_redirects` ADD CONSTRAINT `landing_slug_redirects_post_id_landing_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `landing_posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `landing_posts_published_idx` ON `landing_posts` (`status`,`published_at`);