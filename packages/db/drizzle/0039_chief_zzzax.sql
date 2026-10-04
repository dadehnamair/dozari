CREATE TABLE `level_road` (
	`level` int NOT NULL,
	`start_xp` int NOT NULL,
	`reward_coins` int NOT NULL DEFAULT 0,
	CONSTRAINT `level_road_level` PRIMARY KEY(`level`)
);
