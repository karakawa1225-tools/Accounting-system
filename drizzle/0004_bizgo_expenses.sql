CREATE TABLE `bizgo_expense_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`import_batch_id` text NOT NULL,
	`settlement_month` text NOT NULL,
	`subject` text,
	`detail_date` text,
	`category_label` text NOT NULL,
	`account_id` text,
	`amount_incl_tax_minor` integer DEFAULT 0 NOT NULL,
	`tax_category` text,
	`amount_excl_tax_minor` integer DEFAULT 0 NOT NULL,
	`tax_amount_minor` integer DEFAULT 0 NOT NULL,
	`summary` text,
	`has_receipt` text,
	`invoice_flag` text,
	`registration_number` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `bizgo_expense_month_idx` ON `bizgo_expense_lines` (`settlement_month`);--> statement-breakpoint
CREATE INDEX `bizgo_expense_batch_idx` ON `bizgo_expense_lines` (`import_batch_id`);--> statement-breakpoint
CREATE INDEX `bizgo_expense_account_idx` ON `bizgo_expense_lines` (`account_id`);--> statement-breakpoint
CREATE INDEX `bizgo_expense_category_idx` ON `bizgo_expense_lines` (`category_label`);--> statement-breakpoint
CREATE INDEX `bizgo_expense_tax_cat_idx` ON `bizgo_expense_lines` (`tax_category`);--> statement-breakpoint
CREATE TABLE `bizgo_trip_expense_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`import_batch_id` text NOT NULL,
	`target_month` text NOT NULL,
	`subject` text,
	`trip_start_date` text,
	`trip_end_date` text,
	`trip_days` text,
	`one_way_distance_km` text,
	`lodging` text,
	`daily_allowance_total_minor` integer DEFAULT 0 NOT NULL,
	`detail_date` text,
	`category_label` text NOT NULL,
	`account_id` text,
	`amount_incl_tax_minor` integer DEFAULT 0 NOT NULL,
	`tax_category` text,
	`amount_excl_tax_minor` integer DEFAULT 0 NOT NULL,
	`tax_amount_minor` integer DEFAULT 0 NOT NULL,
	`summary` text,
	`has_receipt` text,
	`invoice_flag` text,
	`registration_number` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `bizgo_trip_month_idx` ON `bizgo_trip_expense_lines` (`target_month`);--> statement-breakpoint
CREATE INDEX `bizgo_trip_batch_idx` ON `bizgo_trip_expense_lines` (`import_batch_id`);--> statement-breakpoint
CREATE INDEX `bizgo_trip_account_idx` ON `bizgo_trip_expense_lines` (`account_id`);--> statement-breakpoint
CREATE INDEX `bizgo_trip_category_idx` ON `bizgo_trip_expense_lines` (`category_label`);--> statement-breakpoint
CREATE INDEX `bizgo_trip_tax_cat_idx` ON `bizgo_trip_expense_lines` (`tax_category`);
