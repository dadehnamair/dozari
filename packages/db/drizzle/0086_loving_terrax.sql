CREATE TABLE `friend_contacts` (
	`owner_id` char(36) NOT NULL,
	`friend_id` char(36) NOT NULL,
	`contact_name` varchar(80) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `friend_contacts_owner_id_friend_id_pk` PRIMARY KEY(`owner_id`,`friend_id`)
);
--> statement-breakpoint
ALTER TABLE `friend_contacts` ADD CONSTRAINT `friend_contacts_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `friend_contacts` ADD CONSTRAINT `friend_contacts_friend_id_users_id_fk` FOREIGN KEY (`friend_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;