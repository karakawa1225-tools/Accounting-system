CREATE TABLE `ap_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text NOT NULL,
	`payment_ap_debit_transaction_id` text NOT NULL,
	`purchase_ap_credit_transaction_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_ap_debit_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_ap_credit_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ap_alloc_vendor_idx` ON `ap_allocations` (`vendor_id`);--> statement-breakpoint
CREATE INDEX `ap_alloc_purchase_idx` ON `ap_allocations` (`purchase_ap_credit_transaction_id`);--> statement-breakpoint
CREATE TABLE `ar_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`payment_ar_credit_transaction_id` text NOT NULL,
	`sales_ar_debit_transaction_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_ar_credit_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sales_ar_debit_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ar_alloc_customer_idx` ON `ar_allocations` (`customer_id`);--> statement-breakpoint
CREATE INDEX `ar_alloc_sales_idx` ON `ar_allocations` (`sales_ar_debit_transaction_id`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `entry_group_id` text;--> statement-breakpoint
CREATE INDEX `transactions_entry_group_idx` ON `transactions` (`entry_group_id`);--> statement-breakpoint
CREATE INDEX `transactions_customer_idx` ON `transactions` (`customer_id`);--> statement-breakpoint
CREATE INDEX `transactions_vendor_idx` ON `transactions` (`vendor_id`);