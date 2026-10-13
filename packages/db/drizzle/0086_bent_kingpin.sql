CREATE TABLE `product_categories` (
	`id` char(36) NOT NULL,
	`slug` varchar(40) NOT NULL,
	`name_fa` varchar(60) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `product_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `price_candidates` MODIFY COLUMN `category_guess` varchar(40);--> statement-breakpoint
ALTER TABLE `products` MODIFY COLUMN `category` varchar(40) NOT NULL;--> statement-breakpoint
ALTER TABLE `puzzle_groups` MODIFY COLUMN `rule_category` varchar(40);
--> statement-breakpoint
INSERT INTO `product_categories` (`id`,`slug`,`name_fa`,`sort_order`,`is_active`) VALUES
('00000000-0000-7000-c000-000000000001','car','خودرو',1,1),
('00000000-0000-7000-c000-000000000002','food','خوراکی',2,1),
('00000000-0000-7000-c000-000000000003','snack','تنقلات',3,1),
('00000000-0000-7000-c000-000000000004','drink','نوشیدنی',4,1),
('00000000-0000-7000-c000-000000000005','digital','دیجیتال',5,1),
('00000000-0000-7000-c000-000000000006','electronics','لوازم برقی',6,1),
('00000000-0000-7000-c000-000000000007','housing','مسکن',7,1),
('00000000-0000-7000-c000-000000000008','transport','رفت‌وآمد',8,1),
('00000000-0000-7000-c000-000000000009','education','تحصیل',9,1),
('00000000-0000-7000-c000-000000000010','entertainment','سرگرمی',10,1),
('00000000-0000-7000-c000-000000000011','clothing','پوشاک',11,1),
('00000000-0000-7000-c000-000000000012','hygiene','بهداشتی',12,1),
('00000000-0000-7000-c000-000000000013','service','خدمات',13,1),
('00000000-0000-7000-c000-000000000014','other','متفرقه',14,1);
