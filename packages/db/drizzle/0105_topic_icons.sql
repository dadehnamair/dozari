-- Topics keep the icon the app used to pick by name (D250): only those that have none yet, so an admin's choice is never overwritten.
UPDATE `puzzle_topics` SET `icon_key` = 'burger' WHERE `name_fa` = 'خوراکی' AND `icon_key` IS NULL;
--> statement-breakpoint
UPDATE `puzzle_topics` SET `icon_key` = 'medal' WHERE `name_fa` = 'ورزشی' AND `icon_key` IS NULL;
--> statement-breakpoint
UPDATE `puzzle_topics` SET `icon_key` = 'headphones' WHERE `name_fa` = 'سرگرمی' AND `icon_key` IS NULL;
--> statement-breakpoint
UPDATE `puzzle_topics` SET `icon_key` = 'book' WHERE `name_fa` = 'مدرسه' AND `icon_key` IS NULL;
--> statement-breakpoint
UPDATE `puzzle_topics` SET `icon_key` = 'bulb' WHERE `name_fa` = 'عمومی' AND `icon_key` IS NULL;
--> statement-breakpoint
UPDATE `puzzle_topics` SET `icon_key` = 'map' WHERE `name_fa` = 'اماکن' AND `icon_key` IS NULL;
--> statement-breakpoint
UPDATE `puzzle_topics` SET `icon_key` = 'bag' WHERE `name_fa` = 'مهارت/شغل' AND `icon_key` IS NULL;
--> statement-breakpoint
UPDATE `puzzle_topics` SET `icon_key` = 'peykan' WHERE `name_fa` = 'خودرو' AND `icon_key` IS NULL;
--> statement-breakpoint
UPDATE `puzzle_topics` SET `icon_key` = 'house' WHERE `name_fa` = 'خونه' AND `icon_key` IS NULL;
--> statement-breakpoint
UPDATE `puzzle_topics` SET `icon_key` = 'heart' WHERE `name_fa` = 'خانواده' AND `icon_key` IS NULL;
--> statement-breakpoint
UPDATE `puzzle_topics` SET `icon_key` = 'ball' WHERE `name_fa` = 'فوتبالی' AND `icon_key` IS NULL;
--> statement-breakpoint
UPDATE `puzzle_topics` SET `icon_key` = 'tulip' WHERE `name_fa` = 'طبیعت' AND `icon_key` IS NULL;
