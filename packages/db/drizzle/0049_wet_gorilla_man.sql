CREATE TABLE `short_links` (
	`code` varchar(24) NOT NULL,
	`target_url` varchar(1000) NOT NULL,
	`note` varchar(120) NOT NULL DEFAULT '',
	`clicks` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`last_click_at` datetime(3),
	CONSTRAINT `short_links_code` PRIMARY KEY(`code`)
);
