CREATE TABLE IF NOT EXISTS `company_bank_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`label` text,
	`bank_name` text,
	`branch_name` text,
	`account_type` text,
	`account_number` text,
	`account_holder` text,
	`account_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE INDEX IF NOT EXISTS `company_bank_accounts_company_idx` ON `company_bank_accounts` (`company_id`);
CREATE INDEX IF NOT EXISTS `company_bank_accounts_account_idx` ON `company_bank_accounts` (`account_id`);
