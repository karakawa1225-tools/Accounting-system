CREATE TABLE `account_divisions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text,
	`name` text NOT NULL,
	`statement_category` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_divisions_code_unique` ON `account_divisions` (`code`);
--> statement-breakpoint
CREATE INDEX `account_divisions_sort_idx` ON `account_divisions` (`sort_order`);
--> statement-breakpoint
ALTER TABLE `accounts` ADD `account_division_id` text REFERENCES `account_divisions`(`id`);
--> statement-breakpoint
CREATE INDEX `accounts_division_idx` ON `accounts` (`account_division_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `account_divisions` (`id`, `code`, `name`, `statement_category`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES
	('d1000000-0000-4000-8000-000000000001', '1', '資産の部', 'asset', 10, 1, 1735689600000, 1735689600000),
	('d1000000-0000-4000-8000-000000000002', '2', '負債の部', 'liability', 20, 1, 1735689600000, 1735689600000),
	('d1000000-0000-4000-8000-000000000003', '3', '純資産の部', 'equity', 30, 1, 1735689600000, 1735689600000),
	('d1000000-0000-4000-8000-000000000004', '4', '収益', 'revenue', 40, 1, 1735689600000, 1735689600000),
	('d1000000-0000-4000-8000-000000000005', '5', '費用', 'expense', 50, 1, 1735689600000, 1735689600000);
--> statement-breakpoint
UPDATE `accounts` SET `account_division_id` = 'd1000000-0000-4000-8000-000000000001' WHERE `category` = 'asset' AND `account_division_id` IS NULL;
--> statement-breakpoint
UPDATE `accounts` SET `account_division_id` = 'd1000000-0000-4000-8000-000000000002' WHERE `category` = 'liability' AND `account_division_id` IS NULL;
--> statement-breakpoint
UPDATE `accounts` SET `account_division_id` = 'd1000000-0000-4000-8000-000000000003' WHERE `category` = 'equity' AND `account_division_id` IS NULL;
--> statement-breakpoint
UPDATE `accounts` SET `account_division_id` = 'd1000000-0000-4000-8000-000000000004' WHERE `category` = 'revenue' AND `account_division_id` IS NULL;
--> statement-breakpoint
UPDATE `accounts` SET `account_division_id` = 'd1000000-0000-4000-8000-000000000005' WHERE `category` = 'expense' AND `account_division_id` IS NULL;
