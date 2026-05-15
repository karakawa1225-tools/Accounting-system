ALTER TABLE `accounts` ADD `category_code` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `barcode_code` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `barcode_code` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `closing_day` integer;--> statement-breakpoint
ALTER TABLE `customers` ADD `payment_site_days` integer;--> statement-breakpoint
ALTER TABLE `vendors` ADD `barcode_code` text;--> statement-breakpoint
ALTER TABLE `vendors` ADD `bank_name` text;--> statement-breakpoint
ALTER TABLE `vendors` ADD `branch_name` text;--> statement-breakpoint
ALTER TABLE `vendors` ADD `account_type` text;--> statement-breakpoint
ALTER TABLE `vendors` ADD `account_number` text;