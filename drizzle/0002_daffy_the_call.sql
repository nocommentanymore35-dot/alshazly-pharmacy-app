ALTER TABLE `banners` MODIFY COLUMN `title` varchar(255);--> statement-breakpoint
ALTER TABLE `medicines` ADD `strips` int DEFAULT 1 NOT NULL;